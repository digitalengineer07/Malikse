const fs = require('fs');
const path = require('path');
const dirs = ['d:/devoxa technologies/malikse/app/app/(tabs)', 'd:/devoxa technologies/malikse/app/components'];

dirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    fs.readdirSync(dir).forEach(file => {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        const p = path.join(dir, file);
        let content = fs.readFileSync(p, 'utf8');
        let newContent = content.replace(/backgroundColor:\s*["'](?:#FFFFFF|#fff|#F8FAFC|#F1F5F9|#F9FAFB)["']/gi, 'backgroundColor: "transparent"');
        if (newContent !== content) {
          fs.writeFileSync(p, newContent);
          console.log('Updated ' + p);
        }
      }
    });
  }
});
