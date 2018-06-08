;(function() {
  let cartridge, mapper, cpu, ppu, mem;

  loadBinary('./rom/color_test.nes', (err, data) => {
    if (err) {
      throw err;
    } else {
      //console.log(data.toString('binary'));
      Load(data);
    }
  });

  function Load(data) {
    cartridge = iNES.newCartridge(data);
    mapper = new Mappers[cartridge.mapper](cartridge);
    cpu = CPU();
    ppu = PPU(Palette, newPPUReg, Screen, cpu);
    mem = Memory(ppu, cartridge, mapper);
    cpu.MEM = mem.CPUMEM;
    ppu.MEM = mem.PPUMEM;

    cpu.powerUp();
    ppu.reset();

    while(1) {
      StepFrame();
    }
  }

  function Step() {
    let cpuCycles = cpu.cycle();
    let ppuCycles = cpuCycles * 3;
    for (let i = 0; i < ppuCycles; i++) {
      ppu.cycle();
    }

    return cpuCycles;
  }

  function StepFrame() {
    let cpuCycles = 0;
    let frame = ppu.getFrame();
    while(frame === ppu.getFrame()) {
      cpuCycles += Step();
    }
    return cpuCycles;
  }

  function loadBinary(path, callback, handleProgress) {
    var req = new XMLHttpRequest();
    req.open("GET", path);
    req.responseType = 'arraybuffer';
    //req.overrideMimeType("text/plain; charset=x-user-defined");
    req.onload = function() {
      var arrayBuffer = req.response;
      if (this.status === 200) {
        if (arrayBuffer) {
          var byteArray = new Uint8Array(arrayBuffer);
          callback(null, byteArray);
        }
      } else if (this.status === 0) {
        // Aborted, so ignore error
      } else {
        callback(new Error(req.statusText));
      }
    };
    req.onerror = function() {
      callback(new Error(req.statusText));
    };
    req.onprogress = handleProgress;
    req.send();
    return req;
  }
  
})()
