import UHR from "./uhr.js";
import { writeFile } from 'node:fs/promises';

const config = {

};

const run = async () => {
  const uhrInstance = new UHR(config);
  const h = await uhrInstance.getAllHorarios({
    asis: [35485, 33447, 33448, 35481],
    asis_curso: [2, 2, 2, 2],
    asis_cuat: ['A', 'A', 'A', 'A'],
    grupos: ['A2', 'A1', 'A1', 'A2'],
    aulas: '',
    tipo: '',
    tit: 2314,
    tit_1: [2314, 2314, 2314, 2314],
    cuat: 'A',
    caca: '2023',
    cen: 'T'
  });

  //console.log(h);

  const ics = uhrInstance.convertToICS(h);

  //console.log(ics);

  await writeFile("test.ics", ics);
};

run();