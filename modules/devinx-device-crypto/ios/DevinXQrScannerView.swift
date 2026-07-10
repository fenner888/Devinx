import AVFoundation
import ExpoModulesCore
import UIKit

public final class DevinXQrScannerView: ExpoView, AVCaptureMetadataOutputObjectsDelegate {
  private static let maximumPayloadBytes = 4_096

  let onCode = EventDispatcher()
  let onError = EventDispatcher()

  private let captureSession = AVCaptureSession()
  private let previewLayer: AVCaptureVideoPreviewLayer
  private let scannerQueue = DispatchQueue(
    label: "com.fenner888.devinx.qr-scanner",
    qos: .userInitiated
  )
  private var notificationTokens: [NSObjectProtocol] = []
  private var isConfigured = false
  private var hasDeliveredResult = false
  private var active = false

  public required init(appContext: AppContext? = nil) {
    previewLayer = AVCaptureVideoPreviewLayer(session: captureSession)
    super.init(appContext: appContext)
    clipsToBounds = true
    previewLayer.videoGravity = .resizeAspectFill
    layer.addSublayer(previewLayer)

    let center = NotificationCenter.default
    notificationTokens = [
      center.addObserver(
        forName: UIApplication.didBecomeActiveNotification,
        object: nil,
        queue: .main
      ) { [weak self] _ in self?.updateRunningState() },
      center.addObserver(
        forName: UIApplication.willResignActiveNotification,
        object: nil,
        queue: .main
      ) { [weak self] _ in self?.stopForLifecycle() },
    ]
  }

  deinit {
    for token in notificationTokens {
      NotificationCenter.default.removeObserver(token)
    }
    let session = captureSession
    scannerQueue.async {
      if session.isRunning { session.stopRunning() }
    }
  }

  public override func layoutSubviews() {
    super.layoutSubviews()
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    previewLayer.frame = bounds
    previewLayer.connection?.videoOrientation = .portrait
    CATransaction.commit()
  }

  public override func didMoveToWindow() {
    super.didMoveToWindow()
    updateRunningState()
  }

  func setActive(_ value: Bool) {
    guard active != value else { return }
    active = value
    scannerQueue.async { [weak self] in
      if !value { self?.hasDeliveredResult = false }
    }
    updateRunningState()
  }

  private func updateRunningState() {
    let shouldRun = active && window != nil && UIApplication.shared.applicationState == .active
    scannerQueue.async { [weak self] in
      self?.setRunning(shouldRun)
    }
  }

  private func stopForLifecycle() {
    scannerQueue.async { [weak self] in
      self?.setRunning(false)
    }
  }

  private func setRunning(_ shouldRun: Bool) {
    if !shouldRun {
      if captureSession.isRunning { captureSession.stopRunning() }
      return
    }
    guard AVCaptureDevice.authorizationStatus(for: .video) == .authorized else {
      emitError("permission_required")
      return
    }
    if !isConfigured && !configureSession() { return }
    guard !hasDeliveredResult else { return }
    if !captureSession.isRunning { captureSession.startRunning() }
  }

  private func configureSession() -> Bool {
    captureSession.beginConfiguration()
    defer { captureSession.commitConfiguration() }
    captureSession.sessionPreset = .high

    guard let camera = AVCaptureDevice.default(
      .builtInWideAngleCamera,
      for: .video,
      position: .back
    ),
    let input = try? AVCaptureDeviceInput(device: camera) else {
      emitError("camera_unavailable")
      return false
    }
    let output = AVCaptureMetadataOutput()
    guard captureSession.canAddInput(input), captureSession.canAddOutput(output) else {
      emitError("configuration_failed")
      return false
    }
    captureSession.addInput(input)
    captureSession.addOutput(output)
    output.setMetadataObjectsDelegate(self, queue: scannerQueue)
    guard output.availableMetadataObjectTypes.contains(.qr) else {
      captureSession.removeOutput(output)
      captureSession.removeInput(input)
      emitError("camera_unavailable")
      return false
    }
    output.metadataObjectTypes = [.qr]
    isConfigured = true
    return true
  }

  public func metadataOutput(
    _ output: AVCaptureMetadataOutput,
    didOutput metadataObjects: [AVMetadataObject],
    from connection: AVCaptureConnection
  ) {
    guard !hasDeliveredResult,
          let code = metadataObjects.first(where: { $0.type == .qr }) as? AVMetadataMachineReadableCodeObject,
          let payload = code.stringValue else {
      return
    }
    let payloadBytes = payload.lengthOfBytes(using: .utf8)
    guard payloadBytes > 0, payloadBytes <= Self.maximumPayloadBytes else {
      hasDeliveredResult = true
      if captureSession.isRunning { captureSession.stopRunning() }
      emitError("invalid_code")
      return
    }
    hasDeliveredResult = true
    if captureSession.isRunning { captureSession.stopRunning() }
    DispatchQueue.main.async { [weak self] in
      self?.onCode(["payload": payload])
    }
  }

  private func emitError(_ code: String) {
    DispatchQueue.main.async { [weak self] in
      self?.onError(["code": code])
    }
  }
}
