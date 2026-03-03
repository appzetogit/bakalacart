const fs = require('fs')
const filePath = 'e:/bakalanew/bakalacart/frontend/src/module/user/pages/Home.jsx'
let content = fs.readFileSync(filePath, 'utf8')
// Find space-hyphen-space between word characters and replace with just hyphen
// Let's also fix common ones like "  -  " or " - "
content = content.replace(/([a-zA-Z0-9])\s+-\s+([a-zA-Z0-9])/g, '$1-$2')
fs.writeFileSync(filePath, content)
console.log('Fixed hyphens')
