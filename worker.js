importScripts('fdvWebplayer/resource_manager.js', 'fdvWebplayer/CODEC.js');

var firstChunks = false;
var keepChunksInCache = false;

let meshMap = {};
var meshesCache = [];
var maxCacheSize = 40;
var currentMesh = null;
var currentFrame = -1;
var resourceManager = new ResourceManagerXHR();

var isDecoding = false;
var isLoaded = false;

function Init3D() {
	var si = resourceManager._sequenceInfo;
  isLoaded = true;
  postMessage({type: 'loaded', sequenceInfo: si});
  Decode();
}
/* start decoding loop */
function Decode() {
  console.log('start decoding');

	var dt = 1000.0 / (resourceManager._sequenceInfo.FrameRate * 3);

	/* Download a first pack of chunks at sequence init, bigger than the next ones */
	 if (firstChunks == false){
		 if ((keepChunksInCache==false && chunks4D.length < resourceManager._sequenceInfo.NbFrames*2)){
			resourceManager._internalCacheSize = 20000000; //20 Mo
			resourceManager.getBunchOfChunks();
		
			console.log('downloading first chunks');
		 } else {}
		 
		 firstChunks = true;
	 }

	/* Decoding loop, 3*fps */
	decodeLoop = setInterval(function () {
		/* Do not decode if enough meshes in cache */
		if (meshesCache.length >= maxCacheSize)
			return;

		/* Decode chunk */
		var mesh4D = Module.DecodeChunk();
		
		/* If a few chunks, download more */
		if (chunks4D.length < 500 || (keepChunksInCache==true && chunks4D.length < resourceManager._sequenceInfo.NbFrames*2)){
			resourceManager._internalCacheSize = 8000000; //8 Mo
			resourceManager.getBunchOfChunks();
		}

		/* If mesh is decoded, we stock it */
		if (mesh4D){
			meshesCache.push(mesh4D);
		}
	}, dt);
	
	isDecoding = true;
}

function emitMesh(mesharrays) {
  if (meshesCache.length == 0) {
    // 4dviews player hasn't given us any frames yet, delay until ready
    // FIXME - should be event or async function based
    setTimeout(() => emitMesh(mesharrays), 0);
  } else {
    //console.log('populate frame', mesharrays);
    let mesh4D = meshesCache.shift();
    meshMap[mesh4D.frame] = mesh4D;

    let obj = {
      frame: mesh4D.frame,
      verts: mesh4D.GetVertices(),
      faces:  mesh4D.GetFaces(),
      uvs: mesh4D.GetUVs(),
      texture: mesh4D.GetTexture(),
      numverts: mesh4D.nbVertices,
      numfaces: mesh4D.nbFaces,
    };
    obj.normals = generateNormals(obj);
    obj.radius = 0;
    for (let i = 0; i < obj.verts.length; i++) {
      let len = obj.verts[i];
      if (len > obj.radius) obj.radius = len;
    }
    //console.log('copy mesh to array', mesharrays, obj);
    mesharrays.frame = obj.frame;
    if (obj.verts.length > 0) {
      mesharrays.vertices.set(obj.verts);
      mesharrays.normals.set(obj.normals);
      mesharrays.uvs.set(obj.uvs);
      mesharrays.indices.set(obj.faces);
      mesharrays.texture.set(obj.texture);
    }
    mesharrays.radius = obj.radius;
    mesharrays.numverts = obj.numverts;
    mesharrays.numfaces = obj.numfaces;

    postMessage({
      type: 'frame',
      frame: obj.frame,
      framedata: mesharrays,
    }, [mesharrays.buffer]);

    mesh4D.delete();
  }
}

// Minimal Vector3 class for performing cross product to calculate normals
function Vector3( x, y, z ) {

	this.x = x || 0;
	this.y = y || 0;
	this.z = z || 0;

}

Object.assign( Vector3.prototype, {

	isVector3: true,

	fromArray: function ( array, offset ) {

		if ( offset === undefined ) offset = 0;

		this.x = array[ offset ];
		this.y = array[ offset + 1 ];
		this.z = array[ offset + 2 ];

		return this;

	},
	subVectors: function ( a, b ) {

		this.x = a.x - b.x;
		this.y = a.y - b.y;
		this.z = a.z - b.z;

		return this;

	},
	cross: function ( v, w ) {

		if ( w !== undefined ) {

			console.warn( 'THREE.Vector3: .cross() now only accepts one argument. Use .crossVectors( a, b ) instead.' );
			return this.crossVectors( v, w );

		}

		return this.crossVectors( this, v );

	},
	crossVectors: function ( a, b ) {

		var ax = a.x, ay = a.y, az = a.z;
		var bx = b.x, by = b.y, bz = b.z;

		this.x = ay * bz - az * by;
		this.y = az * bx - ax * bz;
		this.z = ax * by - ay * bx;

		return this;

	},
});

var pA = new Vector3(), pB = new Vector3(), pC = new Vector3();
var cb = new Vector3(), ab = new Vector3();
function generateNormals(mesh) {
  var index = mesh.faces;
  var positions = mesh.verts;

  let normals = new Float32Array(positions.length);

  if ( positions ) {

    var vA, vB, vC;

    // indexed elements

    if ( index ) {

      for ( var i = 0, il = index.length; i < il; i += 3 ) {

        vA = index[ i + 0 ] * 3;
        vB = index[ i + 1 ] * 3;
        vC = index[ i + 2 ] * 3;

        pA.fromArray( positions, vA );
        pB.fromArray( positions, vB );
        pC.fromArray( positions, vC );

        cb.subVectors( pC, pB );
        ab.subVectors( pA, pB );
        cb.cross( ab );

        normals[ vA ] += cb.x;
        normals[ vA + 1 ] += cb.y;
        normals[ vA + 2 ] += cb.z;

        normals[ vB ] += cb.x;
        normals[ vB + 1 ] += cb.y;
        normals[ vB + 2 ] += cb.z;

        normals[ vC ] += cb.x;
        normals[ vC + 1 ] += cb.y;
        normals[ vC + 2 ] += cb.z;

      }
    }
  }
  return normals;
}
function freeMesh(mesh4D) {
  if (meshMap[mesh4D.frame]) {
    meshMap[mesh4D.frame].delete();
    delete meshMap[mesh4D.frame];
  }
}

// Wait until WASM module is loaded, then finish initialization
let initTimer = setInterval(() => {
  if (Module.LinearEBD4DVDecoder) {
    clearInterval(initTimer);
    Module.Create();
    postMessage({type: 'initialized'});
  }
}, 10);

addEventListener('message', ev => {
  if (ev.data.type == 'load') {
    File4ds = ev.data.src;
    resourceManager.Open(Init3D);
  } else if (ev.data.type == 'requestframe') {
    emitMesh(ev.data.framedata);
  }
});
