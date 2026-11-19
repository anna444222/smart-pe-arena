export class AITracker {
  constructor() { this.landmarker = null; this.stream = null; this.isLoaded = false; this.isDetecting = false; this.lastVideoTime = -1; }
  async initAI() {
    if (this.isLoaded && this.landmarker) return true;
    try {
      const visionModule = await import('/ai/vision_bundle.mjs');
      const { PoseLandmarker, FilesetResolver } = visionModule;
      const vision = await FilesetResolver.forVisionTasks('/ai/wasm');
      this.landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: '/ai/pose_landmarker_lite.task', delegate: 'GPU' },
        runningMode: 'VIDEO', numPoses: 1,
        minPoseDetectionConfidence: 0.55, minPosePresenceConfidence: 0.55, minTrackingConfidence: 0.55
      });
      this.isLoaded = true;
      return true;
    } catch (err) {
      throw { title: 'โหลดโมเดล AI ไม่สำเร็จ', desc: 'ไม่พบไฟล์โมเดล AI ในโฟลเดอร์ /ai/', tech: err?.message || String(err) };
    }
  }
  async startCamera(videoElement) {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('ต้องเปิดผ่าน HTTPS');
      if (this.stream) { this.attachStream(videoElement); return true; }
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      await this.attachStream(videoElement);
      return true;
    } catch (err) {
      let desc = 'ไม่สามารถเปิดกล้องได้ กรุณากดอนุญาต (Allow) การเข้าถึงกล้อง';
      if (err.name === 'NotAllowedError') desc = 'คุณได้ปฏิเสธสิทธิ์การใช้กล้อง กรุณาเปิดสิทธิ์ในการตั้งค่า';
      if (err.name === 'NotFoundError') desc = 'ไม่พบอุปกรณ์กล้องบนเครื่องนี้';
      throw { title: 'ปัญหาการเชื่อมต่อกล้อง', desc, tech: err.name + ': ' + err.message };
    }
  }
  async attachStream(videoElement) {
    videoElement.srcObject = this.stream;
    return new Promise((resolve) => { videoElement.onloadedmetadata = () => { videoElement.play(); resolve(); }; });
  }
  stopCamera() { if (this.stream) { this.stream.getTracks().forEach((t) => t.stop()); this.stream = null; } }
  detect(videoElement) {
    if (!this.isLoaded || !this.landmarker || !videoElement || videoElement.readyState < 2) return null;
    if (this.isDetecting || videoElement.currentTime === this.lastVideoTime) return null;
    this.isDetecting = true; this.lastVideoTime = videoElement.currentTime;
    try {
      const result = this.landmarker.detectForVideo(videoElement, performance.now());
      this.isDetecting = false;
      if (result && result.landmarks && result.landmarks.length > 0) return this.mapLandmarksMirrored(result.landmarks[0]);
      return null;
    } catch (e) { this.isDetecting = false; return null; }
  }
  mapLandmarksMirrored(lm) {
    const getPt = (idx) => ({ x: 1 - lm[idx].x, y: lm[idx].y, v: lm[idx].visibility ?? 0 });
    return {
      nose: getPt(0), leftShoulder: getPt(11), rightShoulder: getPt(12),
      leftElbow: getPt(13), rightElbow: getPt(14), leftWrist: getPt(15), rightWrist: getPt(16),
      leftHip: getPt(23), rightHip: getPt(24), leftKnee: getPt(25), rightKnee: getPt(26),
      leftAnkle: getPt(27), rightAnkle: getPt(28)
    };
  }
  static calculateAngle(a, b, c) {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) angle = 360 - angle;
    return angle;
  }
}