# Volumetric Video Player
This library wraps 4dviews' WASM decoder in a worker and makes the raw frame data available so it can be used in other web-based 3d engines.  The library itself is engine-agnostic, and will emit events containing ArrayBuffer that have been filled with frame data.

To get this data into your engine, create a `VolumetricPlayer4Dview` object and point it at your .4ds file.  Add an event listener for the 'frame' event, and then do whatever is necessary to get that frame data in to a format your engine understands.  A reference implementation for JanusXR is included, which should serve as a good example for porting to any other Three.js-based engine.

## Using
This library was developed as a proof of concept to see if this would be possible, so consider it to be in a prototype stage.  You'll probably need to do some custom work to get this integrated with your systems.

First you'll need to grab the 4DViews Webplayer Library from their website.  When I wrote this, the current version was 1.0.0.  https://www.4dviews.com/volumetric-resources

Extract the `fdvWebplayer` directory into this directory, and then copy fdvWebplayer/CODEC.wasm to the root directory (FIXME - this shouldn't be needed, but currently is because the WASM loader searches in the same dir as your script is loaded from, rather than from the fdvWebplayer directory)

Pull the JS file for the player 

