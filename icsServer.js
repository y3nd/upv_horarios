import UHR from "./uhr.js";
import http from "node:http";
import url from 'node:url';
import crypto from 'crypto';

class UHRICSServer {
  constructor(config) {
    this.config = {
      port: config.port || 9060,
      host: config.host || "0.0.0.0",
      cacheExpirationTime: 2*60*60*1000
      //cacheExpirationTime: 1*30*1000
    };

    this.u = new UHR({});

    this.cache = new Map();

    this.usageStr = "Usage:<br>";
    this.usageStr += "GET request with query string<br>"
    this.usageStr += "List are separated by commas, no space<br><br>",
    this.usageStr += "Required fields: asis, curso, grupos, tit<br>";
    this.usageStr += "- asis is the list of subjects<br>";
    this.usageStr += "- curso is the year of the course<br>";
    this.usageStr += "- cuat is the quadrimester letter<br>";
    this.usageStr += "- tit is the course number<br><br>";
    this.usageStr += `Cache is per query and is kept for ${this.config.cacheExpirationTime/(60*1000)} minutes<br>`;
    this.usageStr += "Example:<br>";
    this.usageStr += "<a href=\"/?asis=35485,33447,33448,35481&curso=2&cuat=A&grupos=A2,A1,A1,A2&tit=2314\" target=\"_blank\">asis=35485,33447,33448,35481&curso=2&cuat=A&grupos=A2,A1,A1,A2&tit=2314</a>";
  }

  init() {
    this.server = http.createServer(async (req, res) => {
      console.log(req.method, req.url);

      const q = url.parse(req.url, true).query;

      if(req.url.endsWith("/")) {
        res.setHeader("Content-Type", "text/html");
        res.writeHead(200);
        res.end(this.usageStr);
        return;
      }

      if(!q.asis || !q.grupos) {
        res.writeHead(400);
        res.end("Bad request");
        return;
      }

      const query = {
        asis: q.asis.split(","),
        asis_curso: Array(q.asis.length).fill(q.curso),
        asis_cuat: Array(q.asis.length).fill(q.cuat),
        grupos: q.grupos.split(","),
        aulas: '',
        tipo: '',
        tit: q.tit,
        tit_1: Array(q.asis.length).fill(q.tit),
        cuat: q.cuat || "A",
        caca: q.caca || 2023,
        cen: q.cen || "T"
      }

      if(!this.validateQuery(query)) {
        res.writeHead(400);
        res.end("Bad request");
        return;
      }

      const queryCacheKey = crypto.createHash('sha256').update(JSON.stringify(query)).digest('hex').substring(0, 16);

      let cacheItem = this.cache.get(queryCacheKey);

      if (!cacheItem || cacheItem.date < Date.now()-this.config.cacheExpirationTime) {
        console.log("cache miss for", queryCacheKey);

        const h = await this.u.getAllHorarios(query);

        const hICS = this.u.convertToICS(h);

        cacheItem = { out: hICS, date: Date.now() };

        this.cache.set(queryCacheKey, cacheItem);
      } else {
        console.log("cache HIT for", queryCacheKey);
      }

      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Last-Modified", new Date(cacheItem.date));
      res.setHeader("Content-Type", "text/calendar");
      res.writeHead(200);
      res.end(cacheItem.out);
    });
    this.server.listen(this.config.port, this.config.host, () => {
      console.log(`Server is running on http://${this.config.host}:${this.config.port}`);
    });


  }

  validateQuery(q) {
    return true;
  }


}

const uhricsServerInstance = new UHRICSServer({});
uhricsServerInstance.init();