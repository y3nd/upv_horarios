import https from 'https';
import { jsonrepair } from 'jsonrepair';
import crypto from 'crypto';

/*
 request to make
 POST https://www.iccp.upv.es/web2/horariosAjax.aspx
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
asis=35485%2C33447%2C33448%2C35481&asis_curso=2%2C2%2C2%2C2&asis_cuat=A%2CA%2CA%2CA&grupos=A2%2CA1%2CA1%2CA2&aulas=&tipo=&fecha_ini=18%2F09%2F2023&tit=2314&tit_1=2314%2C2314%2C2314%2C2314&cuat=A&caca=2023&cen=T&token=NVEWxZF5%2Fn5AF14dYPvly5D6LBe3q4MdioLHgU994aQ%3D
*/

class UHR {
  constructor(config) {
    this.config = {
      debug: config.debug || false
    };

    this.token = null;
  }

  async getAllHorarios(options) {
    if(!this.weeks) {
      await this.connect();
    }

    const horarios = [];

    for(const week of this.weeks) {
      const h = await this.getHorarios({
        ...options,
        fecha_ini: week
      });

      if(!h) {
        continue;
      }

      horarios.push(...h);

      //console.log(`Week ${week} done`);
    }

    return horarios;
  }

  async connect() {
    const url = "https://www.iccp.upv.es/web2/horarios.aspx?curso=2022&nec=T";

    const response = await this.req('GET', url);
    // find token in js code
    const matchToken = response.match(/"token": '(.+?)'/);

    if (!matchToken) {
      throw new Error('Token not found');
    }
    this.token = matchToken[1];

    const weeksRegex = /value=\"(\d{2}\/\d{2}\/\d{4})\">Semana/gm;
    let s;
    const weeks = [];
    while ((s = weeksRegex.exec(response)) !== null) {
      weeks.push(s[1]);
    }

    this.weeks = weeks;

    //console.log(weeks);

    //console.log(this.token);

    return this.token;
  }

  async getHorarios(options) {
    if (!this.token) {
      await this.connect();
    }

    const data = {
      asis: options.asis.join(','),
      asis_curso: options.asis_curso.join(','),
      asis_cuat: options.asis_cuat.join(','),
      grupos: options.grupos.join(','),
      aulas: options.aulas,
      tipo: options.tipo,
      fecha_ini: options.fecha_ini,
      tit: options.tit,
      tit_1: options.tit_1.join(','),
      cuat: options.cuat,
      caca: options.caca,
      cen: options.cen,
      token: this.token
    };

    const url = 'https://www.iccp.upv.es/web2/horariosAjax.aspx';
    const response = await this.req('POST', url, data);

    const match = response.match(/"horarios": (.*)/);

    if(!match) {
      throw new Error('Horarios not found');
    }

    const horariosStr = jsonrepair(`{${match[0]}}`);

    const horarios = JSON.parse(horariosStr);

    if(!(Symbol.iterator in Object(horarios.horarios))) {
      return null;
    }

    for(const h of horarios.horarios) {
      const str = JSON.stringify(h);
      const hash = crypto.createHash('sha256').update(str).digest('hex');
      h.uid = hash;
    }

    return horarios.horarios;
  }

  async getHorariosICS(options) {
    const horarios = await this.getHorarios(options);

    const ics = this.convertToICS(horarios);

    return ics;
  }

  convertToICS(horarios) {
    let icsOutput = ``;
    icsOutput += "BEGIN:VCALENDAR\n";
    icsOutput += "VERSION:2.0\n";

    for(const h of horarios) {
      const startDateFormatted = h.fecha_m.split('/').reverse().join('');
      const endDateFormatted = h.fecha_m.split('/').reverse().join('');

      /* source example
    h = {
    codasi: 35485,
      nomasig: 'integración de tecnologías y sistemas de telecomunicación',
      curso: '2',
      tipo: '',
      tipoabb: 'T',
      grupo: 'A',
      grupom: 'A1,A2,A3,A4',
      idioma: 'Inglés',
      fecha: '09/18/2023',
      fecha_m: '18/09/2023',
      dia: 1,
      hora: 15,
      minuto: 0,
      duracion: 255,
      espacio: '4D - AULA 2.7',
      codgis: 'V.4D.2.036',
      codgis_nombre: 'Edificio 4D - Planta 2',
      hora_ini: '15:00',
      hora_fin: '19:15',
      pdi: 'Reig Pascual, Juan-De-Ribera',
      color: '0',
      color_1: 'rgb(209,195,109)',
      color_2: 'rgb(230,128,67)'
    }
    */

      icsOutput += "BEGIN:VEVENT\n";
      icsOutput += `UID: ${h.uid}\n`;
      icsOutput += `DTSTART:${startDateFormatted}T${h.hora_ini.replace(":", "")}00\n`;
      icsOutput += `DTEND:${endDateFormatted}T${h.hora_fin.replace(":", "")}00\n`;
      icsOutput += `SUMMARY:${h.nomasig}\n`;
      icsOutput += `DESCRIPTION:${h.grupo}\n`;
      icsOutput += `LOCATION:${h.espacio}\n`;
      icsOutput += "END:VEVENT\n";
    }

    icsOutput += "END:VCALENDAR\n";

    return icsOutput;
  }

  /**
   * Used to make a HTTP request
   * @param {String} method 
   * @param {String} url
   * @param {Object} data // single level object
   * @returns 
   */
  req(method, url, data) {
    return new Promise((resolve, reject) => {
      const req = https.request(url, {
        method,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        }
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);

      if (typeof data === "object") {
        // format data and url encode it
        const formattedData = Object.entries(data).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&');
        req.write(formattedData);
      }

      req.end();
    });
  }
}

export default UHR;