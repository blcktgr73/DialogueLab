const fs = require('fs');
try {
    const content = fs.readFileSync('202601311558.log', 'utf16le');
    fs.writeFileSync('202601311558_utf8.log', content, 'utf8');
    console.log('Conversion successful');
} catch (e) {
    console.error('Conversion failed:', e);
}
