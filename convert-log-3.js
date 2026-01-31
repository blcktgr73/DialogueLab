const fs = require('fs');
try {
    const content = fs.readFileSync('20260131_1633.log', 'utf16le');
    fs.writeFileSync('20260131_1633_utf8.log', content, 'utf8');
    console.log('Conversion successful');
} catch (e) {
    console.error('Conversion failed:', e);
}
