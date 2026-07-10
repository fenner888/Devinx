import idle00 from '../../../assets/pets/devin/assets/frames/idle/00.png';
import idle01 from '../../../assets/pets/devin/assets/frames/idle/01.png';
import idle02 from '../../../assets/pets/devin/assets/frames/idle/02.png';
import idle03 from '../../../assets/pets/devin/assets/frames/idle/03.png';
import idle04 from '../../../assets/pets/devin/assets/frames/idle/04.png';
import idle05 from '../../../assets/pets/devin/assets/frames/idle/05.png';
import runningRight00 from '../../../assets/pets/devin/assets/frames/running-right/00.png';
import runningRight01 from '../../../assets/pets/devin/assets/frames/running-right/01.png';
import runningRight02 from '../../../assets/pets/devin/assets/frames/running-right/02.png';
import runningRight03 from '../../../assets/pets/devin/assets/frames/running-right/03.png';
import runningRight04 from '../../../assets/pets/devin/assets/frames/running-right/04.png';
import runningRight05 from '../../../assets/pets/devin/assets/frames/running-right/05.png';
import runningRight06 from '../../../assets/pets/devin/assets/frames/running-right/06.png';
import runningRight07 from '../../../assets/pets/devin/assets/frames/running-right/07.png';
import runningLeft00 from '../../../assets/pets/devin/assets/frames/running-left/00.png';
import runningLeft01 from '../../../assets/pets/devin/assets/frames/running-left/01.png';
import runningLeft02 from '../../../assets/pets/devin/assets/frames/running-left/02.png';
import runningLeft03 from '../../../assets/pets/devin/assets/frames/running-left/03.png';
import runningLeft04 from '../../../assets/pets/devin/assets/frames/running-left/04.png';
import runningLeft05 from '../../../assets/pets/devin/assets/frames/running-left/05.png';
import runningLeft06 from '../../../assets/pets/devin/assets/frames/running-left/06.png';
import runningLeft07 from '../../../assets/pets/devin/assets/frames/running-left/07.png';
import waving00 from '../../../assets/pets/devin/assets/frames/waving/00.png';
import waving01 from '../../../assets/pets/devin/assets/frames/waving/01.png';
import waving02 from '../../../assets/pets/devin/assets/frames/waving/02.png';
import waving03 from '../../../assets/pets/devin/assets/frames/waving/03.png';
import jumping00 from '../../../assets/pets/devin/assets/frames/jumping/00.png';
import jumping01 from '../../../assets/pets/devin/assets/frames/jumping/01.png';
import jumping02 from '../../../assets/pets/devin/assets/frames/jumping/02.png';
import jumping03 from '../../../assets/pets/devin/assets/frames/jumping/03.png';
import jumping04 from '../../../assets/pets/devin/assets/frames/jumping/04.png';
import failed00 from '../../../assets/pets/devin/assets/frames/failed/00.png';
import failed01 from '../../../assets/pets/devin/assets/frames/failed/01.png';
import failed02 from '../../../assets/pets/devin/assets/frames/failed/02.png';
import failed03 from '../../../assets/pets/devin/assets/frames/failed/03.png';
import failed04 from '../../../assets/pets/devin/assets/frames/failed/04.png';
import failed05 from '../../../assets/pets/devin/assets/frames/failed/05.png';
import failed06 from '../../../assets/pets/devin/assets/frames/failed/06.png';
import failed07 from '../../../assets/pets/devin/assets/frames/failed/07.png';
import waiting00 from '../../../assets/pets/devin/assets/frames/waiting/00.png';
import waiting01 from '../../../assets/pets/devin/assets/frames/waiting/01.png';
import waiting02 from '../../../assets/pets/devin/assets/frames/waiting/02.png';
import waiting03 from '../../../assets/pets/devin/assets/frames/waiting/03.png';
import waiting04 from '../../../assets/pets/devin/assets/frames/waiting/04.png';
import waiting05 from '../../../assets/pets/devin/assets/frames/waiting/05.png';
import running00 from '../../../assets/pets/devin/assets/frames/running/00.png';
import running01 from '../../../assets/pets/devin/assets/frames/running/01.png';
import running02 from '../../../assets/pets/devin/assets/frames/running/02.png';
import running03 from '../../../assets/pets/devin/assets/frames/running/03.png';
import running04 from '../../../assets/pets/devin/assets/frames/running/04.png';
import running05 from '../../../assets/pets/devin/assets/frames/running/05.png';
import review00 from '../../../assets/pets/devin/assets/frames/review/00.png';
import review01 from '../../../assets/pets/devin/assets/frames/review/01.png';
import review02 from '../../../assets/pets/devin/assets/frames/review/02.png';
import review03 from '../../../assets/pets/devin/assets/frames/review/03.png';
import review04 from '../../../assets/pets/devin/assets/frames/review/04.png';
import review05 from '../../../assets/pets/devin/assets/frames/review/05.png';

export const DEVIN_FRAME_SETS = {
  idle: [idle00, idle01, idle02, idle03, idle04, idle05],
  'running-right': [
    runningRight00,
    runningRight01,
    runningRight02,
    runningRight03,
    runningRight04,
    runningRight05,
    runningRight06,
    runningRight07,
  ],
  'running-left': [
    runningLeft00,
    runningLeft01,
    runningLeft02,
    runningLeft03,
    runningLeft04,
    runningLeft05,
    runningLeft06,
    runningLeft07,
  ],
  waving: [waving00, waving01, waving02, waving03],
  jumping: [jumping00, jumping01, jumping02, jumping03, jumping04],
  failed: [failed00, failed01, failed02, failed03, failed04, failed05, failed06, failed07],
  waiting: [waiting00, waiting01, waiting02, waiting03, waiting04, waiting05],
  running: [running00, running01, running02, running03, running04, running05],
  review: [review00, review01, review02, review03, review04, review05],
} as const;

export type DevinAnimationRow = keyof typeof DEVIN_FRAME_SETS;
