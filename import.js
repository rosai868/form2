// import.js
const admin = require('firebase-admin');

// --- 1. 設定ファイルの読み込み ---
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  // ★★★ 自分のFirestoreのURL（'https://PROJECT-ID.firebaseio.com' など）を追加 ★★★
  // ※これは Firestore > データ の画面上部に表示されている URL です
  databaseURL: 'https://YOUR_PROJECT_ID.firebaseio.com' 
});

const auth = admin.auth();
const db = admin.firestore();

// --- 2. 登録したい職員リスト ---
// ★★★ この配列を、あなたの職員リストに合わせて編集してください ★★★
const usersToCreate = [
  { id: 1, name: '長坂', team: 'A', leader: false, isAdmin: true,  pass: '111111' },
  { id: 2, name: '中里', team: 'A', leader: false, isAdmin: false, pass: '222222' },
  { id: 3, name: '渥美', team: 'A', leader: true,  isAdmin: false, pass: '333333' },
  { id: 4, name: '田中', team: 'A', leader: true,  isAdmin: false, pass: '444444' },
  // ... （ここに全職員の情報を追加） ...
];

// --- 3. 登録実行 ---
async function createUsers() {
  console.log('... ユーザー登録を開始します ...');
  
  for (const userData of usersToCreate) {
    
    const email = `${userData.id}@7w.com`; // ★ あなたのドメイン名
    const password = userData.pass;
    
    try {
      // (1) Authentication にユーザーを作成
      const userRecord = await auth.createUser({
        email: email,
        password: password,
      });

      // (2) 作成と同時に返ってきた「UID」を取得
      const uid = userRecord.uid;
      
      // (3) そのUIDを使って、Firestore の staff コレクションにドキュメントを作成
      await db.collection('staff').doc(uid).set({
        originalId: userData.id,
        name: userData.name,
        team: userData.team,
        leader: userData.leader,
        isAdmin: userData.isAdmin,
        passwordChanged: false // ★ 全員 'false' で作成
      });
      
      console.log(`✅ 成功: ${email} (UID: ${uid}) を作成し、DBに紐付けました。`);

    } catch (error) {
      console.error(`❌ 失敗: ${email} の作成中にエラーが発生しました。`, error.message);
    }
  }
  
  console.log('... 全ての処理が完了しました ...');
}

// スクリプト実行
createUsers();