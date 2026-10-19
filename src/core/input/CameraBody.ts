import type { PoseFrame } from '../pose/landmarks';
import { MotionAnalyzer, type MotionConfig } from '../pose/MotionAnalyzer';
import { PoseTracker, type PoseTrackerOptions } from '../pose/PoseTracker';
import type { BodySource, BodyState } from './BodyState';

/** The real thing: webcam → pose landmarks → motion analysis → BodyState. */
export class CameraBody implements BodySource {
  readonly tracker: PoseTracker;
  readonly analyzer: MotionAnalyzer;
  /** Most recent raw frame (for drawing the camera overlay). */
  lastFrame: PoseFrame | null = null;

  constructor(options: PoseTrackerOptions = {}, motion: Partial<MotionConfig> = {}) {
    this.tracker = new PoseTracker(options);
    this.analyzer = new MotionAnalyzer(motion);
  }

  async init(onStatus?: (msg: string) => void): Promise<void> {
    await this.tracker.init(onStatus);
    this.tracker.start((frame) => {
      this.lastFrame = frame;
      this.analyzer.process(frame);
    });
  }

  get state(): BodyState {
    return this.analyzer.state;
  }

  update(): void {}

  dispose(): void {
    this.tracker.dispose();
  }
}
