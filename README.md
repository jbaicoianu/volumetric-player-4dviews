# Volumetric Video Player
This library wraps 4dviews' WASM decoder in a worker and makes the raw frame data available so it can be used in other web-based 3d engines.  The library itself is engine-agnostic, and will emit events containing ArrayBuffer that have been filled with frame data.

To get this data into your engine, create a `VolumetricPlayer4Dview` object and point it at your .4ds file.  Add an event listener for the 'frame' event, and then do whatever is necessary to get that frame data in to a format your engine understands.  A reference implementation for JanusXR is included, which should serve as a good example for porting to any other Three.js-based engine.

