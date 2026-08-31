const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/lib/FirestoreDB.js');
let content = fs.readFileSync(file, 'utf8');

// Insert saveImapSettings and getImapSettings at the end of the FirestoreStore class prototype before it returns
const methodString = `
    async saveImapSettings(settings) {
      if (!this.uid || !this.db) throw new Error('No valid session');
      const docRef = this.db.collection('users').doc(this.uid);
      await docRef.set({ imap: settings }, { merge: true });
    },

    async getImapSettings() {
      if (!this.uid || !this.db) return null;
      const docRef = this.db.collection('users').doc(this.uid);
      const snap = await docRef.get();
      if (!snap.exists) return null;
      return snap.data().imap || null;
    },
`;

content = content.replace(/async\s+syncUserData\(\)\s*\{[\s\S]*?\},/, match => methodString + '\n    ' + match);

fs.writeFileSync(file, content);
console.log('FirestoreDB.js updated');
