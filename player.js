/*
System Design
-------------

4dview ships a web player that's based on a WASM decoder managed by some JavaScript.
In their default player, this all runs in the main thread, which causes blocking of 
other processes, like the renderer.

Instead, we run our WASM decoder in a worker, so it doesn't slow down our main thread.
Our main thread preallocates buffers for a configurable number of frames, then it
asks the worker to load the 4dview file for us.  Once it reports that the file has been
loaded, we start requesting frames, transferring ownership of one of the framedata 
buffers in our ring buffer.  The worker fills this buffer with the appropriate frame 
data, then transfers ownership back to the main thread.

*/

/**
  * VolumetricFrame4DView
  * ---------------------
  * Represents a single frame of a volumetric video
  */
class VolumetricFrame4DView {
  constructor(seq) {
    this.frame = 0;
    this.ready = true;
    this.played = true;

    let buffersize = seq.MaxVertices * 8 * 4 + seq.MaxTriangles * 3 * 4 + seq.TextureSizeX * seq.TextureSizeY / 2;
    this.buffer = new ArrayBuffer(buffersize);

    this.vertices = new Float32Array(this.buffer, 0, seq.MaxVertices * 3);
    this.normals = new Float32Array(this.buffer, this.vertices.byteLength, seq.MaxVertices * 3);
    this.uvs = new Float32Array(this.buffer, this.normals.byteOffset + this.normals.byteLength, seq.MaxVertices * 2);
    this.indices = new Uint32Array(this.buffer, this.uvs.byteOffset + this.uvs.byteLength, seq.MaxTriangles * 3);
    this.texture = new Uint8Array(this.buffer, this.indices.byteOffset + this.indices.byteLength, seq.TextureSizeX * seq.TextureSizeY / 2);
    this.numverts = seq.MaxVertices;
    this.numfaces = seq.MaxTriangles;
  }
}

/**
  * VolumetricPlayer4DView
  * ---------------------
  * Decodes 4dviews volumetric videos in a worker, and makes frame data available to clients
  */
class VolumetricPlayer4DView extends EventTarget {
  constructor() {
    super();
    this.framecache = [];
    this.cacheframes = 4;
    this.currentframe = 0;
    this.autoplay = true;
    this.loop = true;
    this.workerpath = 'https://assets.metacade.com/volumetric-player-4dview/worker.js'; // FIXME - shouldn't be harcoded
  }
  load(url) {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        this.worker = new Worker(this.workerpath);
        this.worker.addEventListener('message', ev => {
          let msg = ev.data;
          if (msg.type == 'initialized') {
            // Worker's WASM module is ready, tell it to load our file
            this.worker.postMessage({type: 'load', src: url});
          } else if (msg.type == 'loaded') {
            // File loaded, store our sequence info for later reference
            this.updateSequenceInfo(msg.sequenceInfo);
            if (this.autoplay) {
              this.prefetchFrames();
              // FIXME - short delay to allow a few frames to buffer, this should be handled automatically
              setTimeout(() => {
                this.play();
              }, 1000);
            }
            // Load finished successfully
            resolve();
          } else if (msg.type == 'frame') {
            // Received new frame
            this.updateFrameData(msg.framedata);
          }
        });
      }
    });
  }
  updateSequenceInfo(sequenceInfo) {
    this.sequenceInfo = sequenceInfo;
    this.initBuffers(sequenceInfo);
  }
  initBuffers(sequenceInfo) {
    for (let i = 0; i < this.cacheframes; i++) {
      this.framecache[i] = new VolumetricFrame4DView(sequenceInfo);
    }
  }
  play() {
    // TODO - we should start the worker going, then wait until we have a few frames buffered up before we start using them
    // This will allow us to maintain smoother frame timing
    //this.prefetchFrames(this.currentframe);
    setInterval(() => {
      let framedata = this.framecache[this.currentframe % this.cacheframes];
      if (framedata.ready) {
        this.setActiveFrame(this.currentframe);
        this.currentframe++;
        if (this.currentframe >= this.sequenceInfo.NbFrames) {
          this.currentframe = (this.loop ? 0 : this.sequenceInfo.NbFrames - 1);
        }
        this.prefetchFrames();
      }
    }, 1000 / this.sequenceInfo.FrameRate);
  }
  seek(frame) {
    this.currentframe = frame;
  }
  prefetchFrames() {
    for (let i = this.currentframe; i < this.currentframe + this.cacheframes - 1; i++) {
      let frame = i;
      if (frame >= this.sequenceInfo.NbFrames) {
        frame = this.sequenceInfo.NbFrames - 1;
      }
      let framedata = this.framecache[frame % this.cacheframes];
      if (framedata.ready && framedata.played) {
        this.requestFrame(frame);
      }
    }
  }
  requestFrame(frame) {
    // Get the next arraybuffer from our ring buffer, and transfer it to the worker to be populated
    let framedata = this.framecache[frame % this.cacheframes];
    framedata.ready = false;
    this.worker.postMessage({
      type: 'requestframe',
      frame: frame,
      framedata: framedata
    }, [framedata.buffer]);
  }
  setActiveFrame(frame) {
    let framedata = this.framecache[frame % this.cacheframes];
    framedata.played = true;
    // Notify listeners that new frame data is ready to show
    this.dispatchEvent(new CustomEvent('frame', {detail: framedata}));
  }
  updateFrameData(framedata) {
    //console.log('received frame', framedata.frame, framedata);
    this.framecache[framedata.frame % this.cacheframes] = framedata;
    framedata.ready = true;
    framedata.played = false;
  }
}

