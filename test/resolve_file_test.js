import resolve_file from 'src/resolve_file.js'

/***** Test uses Node *****/
if (global && require) {
  const fs = eval('require')('fs');

  const romPath = './rom/test_cpu_flag_concurrency.nes'; // '../rom/cpu_dummy_reads.nes'

  console.log('NESMagicMumber: ' + resolve_file.NESMagicMumber);

  fs.readFile(romPath, (err, data) => {
    if (err) throw err;
    console.log(resolve_file.main(data).header);
  });
}
/***** Test Finished *****/

export default {}
