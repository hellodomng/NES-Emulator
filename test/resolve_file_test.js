import {main, getSpecificedBit, NESMagicMumber} from 'src/resolve_file.js'
import describe from 'test/tools.js';

/***** Test uses Node *****/
if (global && require) {
  const fs = eval('require')('fs');

  const romPath = './rom/dajingang.nes'; // '../rom/cpu_dummy_reads.nes'

  console.log('NESMagicMumber: ' + NESMagicMumber);

  fs.readFile(romPath, (err, data) => {
    if (err) throw err;
    console.log(main(data).header);
  });

  describe('函数 getSpecificedBit', (it, expect) => {
    it('应当返回该数字二进制形式的制定位', () => {
      expect(getSpecificedBit(1, 0)).toequal(1);
      expect(getSpecificedBit(2, 1)).toequal(1);
      expect(getSpecificedBit(10, 3)).toequal(1);
      expect(getSpecificedBit(10, 4)).toequal(0);
    })
  })
}
/***** Test Finished *****/

export default {}
