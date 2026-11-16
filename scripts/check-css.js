const http = require('http');

http.get('http://localhost:3000', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const regex = /href="([^"]+\.css[^"]*)"/g;
    let match;
    const cssLinks = [];
    while ((match = regex.exec(data)) !== null) {
      cssLinks.push(match[1]);
    }
    console.log('CSS links found:', cssLinks);
    cssLinks.forEach(cssUrl => {
      http.get('http://localhost:3000' + cssUrl, (cssRes) => {
        console.log(cssUrl, 'status:', cssRes.statusCode, 'content-type:', cssRes.headers['content-type']);
        let cssBody = '';
        cssRes.on('data', c => cssBody += c);
        cssRes.on('end', () => console.log(cssUrl, 'CSS length:', cssBody.length, 'preview:', cssBody.slice(0, 80)));
      });
    });
  });
});
