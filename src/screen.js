const Screen = (function() {
  class Screen {
    constructor(id, width, height, scale) {
      this.screenObj = document.getElementById(id);
      this.screen = this.screenObj.getContext('2d');
      this.width = width * scale;
      this.height = height * scale;
      this.scale = scale ? scale : 1;

      this.init();
    }
    init() {
      this.screenObj.width = this.width;
      this.screenObj.height = this.height;

      //this.screen.fillStyle = '#000';
      //this.screen.fillRect(0, 0, this.screenObj.width, this.screenObj.height);
    }

    drawPixel(x, y, color) {
      this.screen.fillStyle = color;
      this.screen.fillRect(x, y, x + this.scale, y + this.scale);
    }
  }

  const screen = new Screen('screen', 256, 240, 2);

  return screen;
})();
