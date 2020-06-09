// JanusWeb custom elements for displaying volumetric videos

room.registerElement('volumetric_placeholder', {
  create() {
    this.createObject('object', {
      id: 'cube',
      col: 'blue',
      scale: V(.5, .05, .5)
    });
    let p = this.createObject('particle', {
      col: 'blue',
      scale: V(.08),
      vel: V(-1, 5, -1),
      rand_vel: V(2, 2, 2),
      accel: V(0, -9.8, 0),
      loop: true,
      count: 2000,
      rate: 2,
      duration: 10,
    });
  }
});
room.registerElement('volumetric_4dview', {
  src: '',

  create() {
    this.spinner = this.createObject('volumetric_placeholder');
    if (this.src) {
      this.player = new VolumetricPlayer4DView();
      console.log('created player', this.player);
      this.player.load(this.src).then(ev => this.play(ev));
      this.player.addEventListener('frame', (ev) => this.handleFrame(ev));
    }
  },
  play() {
    this.spinner.die();
  },
  handleLoad(ev) {
  },
  handleFrame(ev) {
    //console.log('new frame', ev);
    if (!this.mesh) {
      this.mesh = this.createMesh(ev.detail);
    } else {
      this.updateMesh(ev.detail);
    }
  },
  createMesh(meshdata) {
    let seq = this.player.sequenceInfo;

    let geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(meshdata.vertices, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(meshdata.normals, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(meshdata.uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(meshdata.indices, 1));
    geometry.dynamic = true;

    let textureFormat = (seq.TextureEncoding == 164 ? THREE.RGBA_ASTC_8x8_Format : THREE.RGB_S3TC_DXT1_Format);
    let texture = new THREE.CompressedTexture(null, seq.TextureSizeX, seq.TextureSizeY,
            textureFormat, THREE.UnsignedByteType, THREE.UVMapping,
            THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping,
            THREE.LinearFilter, THREE.LinearFilter);

    let material = (this.lighting ? new THREE.MeshPhysicalMaterial({ map: texture }) : new THREE.MeshBasicMaterial({ map: texture }));
    //let material = new THREE.MeshBasicMaterial({ color: 0xff0000 })

    this.textureSizeX = seq.TextureSizeX;
    this.textureSizeY = seq.TextureSizeY;

    /* Adding the 3D model */
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.rotation.x = -1.57;

    this.objects['3d'].add(this.mesh);

    return this.mesh;
  },
  updateMesh(meshdata) {
    let geometry = this.mesh.geometry,
        material = this.mesh.material,
        texture = material.map;

    if (geometry.boundingSphere) {
      geometry.boundingSphere.radius = meshdata.radius;
    }

    geometry.attributes.position.array = meshdata.vertices;
    geometry.attributes.normal.array = meshdata.normals;
    geometry.attributes.uv.array = meshdata.uvs;
    geometry.index.array = meshdata.indices;

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.normal.needsUpdate = true;
    geometry.attributes.uv.needsUpdate = true;
    geometry.index.needsUpdate = true;

    geometry.setDrawRange(0, meshdata.numfaces * 3);

//console.log(this.player.sequenceInfo.TextureSizeY);
    if (texture) {
      var mipmap = { "data": meshdata.texture, "width": this.player.sequenceInfo.TextureSizeX, "height": this.player.sequenceInfo.TextureSizeY };
      var mipmaps = [];
      mipmaps.push(mipmap);

      //console.log('update texture', texture, mipmap, this.player.sequenceInfo.TextureSizeX, this.player.sequenceInfo.TextureSizeY, meshdata.texture);
      texture.mipmaps = mipmaps;
      texture.needsUpdate = true
      material.needsUpdate = true;
    }
  }
});

