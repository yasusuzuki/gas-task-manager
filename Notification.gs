
/*************************************************************************************
定期実行のエンドポイント　（毎朝一回の実行を想定。一日に複数回
管理簿の更新および、未了のリマインドを行う

インストール
　・　Google Spreadsheetで回報管理簿シートを作成する
　　　ー　ドキュメントIDは定数「DOCUMENT_ID」に設定されたとおりとする
　　　ー　回報管理簿のシート名は定数「SHEET_NOTIFICATION」に設定されたとおりとする
　　　ー　定数シートに回報管理簿専用の定義を設定する：
　　　　　ー　def_app_config	SLACK_NOTIFICATION_CHANNEL　：投稿を抽出するチャンネルを指定する
　　　　　ー　col_def_notification：　回報管理簿シート上の項目定義
　　　　　ー　def_reaction：　リアクション定義。リアクションと管理簿上の印を紐づける
　・　定期実行で毎朝notificationManager()を実行するように定義する

担当者のルール
　・　チームの”＃ｘｘｘｘｘ”チャンネルに、1行目を”回報”という文字列で開始するメッセージが投稿されると
　　　それは回報となる。リアクションすると、回報を確認したことが管理簿に記録される。
　・　リアクションしていないと毎朝の”＃ＸＸＸＸＸ”チャンネルでリマインドされる
　・　選択式の回答が求められる回報の場合、回報内で案内されたリアクションの中から選ぶ必要がある
　ＴＯＤＯ：　前日の設定を英魚日
回報投稿者のルール
　・　Slack投稿の1行目の先頭を”回報”という文字列で開始すると、翌朝のバッチでSlack Botが回報として自動抽出する。
　　　ー　”回報”の前に半角・全角空白をいれてもよい。
　　　ー　”回報”の直後は少なくとも1つ以上の半角・全角空白をいれなければならない
　　　ー　翌朝の定期実行バッチが回報として認識すると、「回報シート」に回報として自動登録される。
　・　投稿先：回報を投稿できるのは、チームの”＃ｘｘｘｘｘ”チャンネルのみ
　・　依頼先限定：回報の1行目にメンション(@名前)をいれると、回報の確認依頼先を限定できる
　　　ー　1行目にメンションがないと、回報シートに登録された全員を回報確認先となる
　　　ー　2行目以降にメンションをいれても、確認依頼先には影響しない
　・　回報タイトル：投稿の1行目の”回報”以降の文字列が、回報タイトルとして自動抽出される
　　　ー　1行目を長文とすると回報タイトルがわかりにくくなるので注意すること
　・　リアクション：回報確認依頼先のメンバーがリアクションすると管理簿のメンバー欄に"〇"と設定される
　　　ー　「定数シート」に事前定義されたリアクションは、"〇"の代わりに別の事前定義された印が用いられる
　　　ー　選択式の回答を求める場合は、事前定義させたリアクションを有効活用できる
　　　ー　全員がリアクションするとステータス欄が”完了”となる
　・　ステータス欄が”完了”となるまで、毎朝チームのチャンネル上で、未完了メンバーをリマインドする
　　　ー　途中で回報を取り下げたい場合、手動でステータス欄を”取り下げ”などとすればリマインドがやむ
　・　各回報は、ステータスが”完了”となるまで毎朝のバッチで更新される
　　　ー　リアクションだけでなく、回報タイトル、依頼先も更新の対象
　　　ー　例：依頼先の訂正を行いたい場合は、新規投稿せず、既存投稿を更新すればよい

*************************************************************************************/
function notificationManager() {
  updateLogSheet("notificationManager()　開始します。");
  console.log("notificationManager()　開始します");
  let results = [];
  //シート全体に他ユーザによる編集を制限するプロテクションをかける
  protectNotificationSheet();  
  try{
    //登録済みの回報を更新する
    console.log("Call processUpdatedNotification()");
    results = processUpdatedNotification()
    //新規回報を登録する
    console.log("Call processNewNotification()");
    results = results.concat( processNewNotification() )
  } catch (exception) {
    let e = ( exception.stack ? exception.stack : exception.message);
    updateLogSheet("notificationManager()　問題発生！！！中止します　エラーメッセージ["+e+"]");
    throw exception;
  } finally {
    //シートにかかっていたプロテクションをすべて削除する。
    // TODO:他のプロテクションも全部削除してしまう問題を修正する
    removeProtection(); 
  }
  
  if( results.length > 0 ){
    let text = "回報の確認状況　(未完了のみ)\n";
    text = text + results.map(e => Utilities.formatString("<%s|%s> %s %s\n　　　未了[%s]",e.link,e.id,e.creationDateTime,e.title,e.pendAssignees.join(','))).join('\n');
    slackSendMessageToTeam(JSON.stringify([{"type": "section","text": {"type": "mrkdwn","text":text}}]));
  }
  console.log("notificationManager()　完了しました。コマンド抽出件数["+results.length+"]件")
  updateLogSheet("notificationManager()　完了しました。コマンド抽出件数["+results.length+"]件");
}

/*************************************************************************************
昨日の投稿から管理簿に新規登録する
*************************************************************************************/
function processNewNotification(){
  let conv_orig = slackReadMessagesFromNotificationChannel();
  //コマンドが不整合とならないように読み取ったチームチャネルへの投稿を新しい順を古い順に並び替える
  let conv = conv_orig.reverse(); 
  let results = [];
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NOTIFICATION);
  let maxRowIndex = sheet.getDataRange().getLastRow();

  for ( let i=0; i < conv.length; i++ ){
    console.log("%d番目の投稿%s",i+1,JSON.stringify(conv[i]));
    //TODO: 太字、取消線、斜体を正確に判定する
    if ( /^[\u20\u3000~_\*]*?回報[\x20\u3000]+/.test(conv[i].text)) {
      //新規回報を登録する
      //IDを採番しつつ、重複投稿となっていないか確認する
      let channelID = getSlackNotificationChannelID();
      let link = slackLinkToMessage(channelID,conv[i].ts);
      let id = assignNewNotificationID(link);
      if ( id ) {  //重複投稿がある場合は、idはnullが設定されている
        let ret = updateRecord(conv[i].text, conv[i].user, conv[i].ts, conv[i].reactions,id,++maxRowIndex);
        if ( ret.status == "回報中" ) {
          results.push( ret );
        }
      } else {
        console.log("!!例外：重複する投稿が検知されました。処理をスキップします。["+ link +"]への回報");
      }
    }
  }
  return results;
}


/*************************************************************************************
登録済みの”回報中”ステータスの各回報に対して参照先の投稿を確認して管理簿を更新する
*************************************************************************************/
function processUpdatedNotification(){
  //"回報中"の回報をすべて抽出する。
  let col = columnNameMapForA1Notation(COL_DEF_NOTIFICATION);
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NOTIFICATION);
  let results = [];
  let pendNotification = [];

  let stop = stopWatch();
  let finder = sheet
    .getRange(col("ステータス") + "1:" + col("ステータス") + sheet.getDataRange().getLastRow())
    .createTextFinder("(回報中)")
    .useRegularExpression(true);
  finder.findAll().forEach(e => pendNotification.push("A" + e.getRow() + ":" + convertToLetter(sheet.getLastColumn()) + e.getRow()));
  if ( pendNotification.length == 0 ) { return results; }
  let dataRanges = sheet.getRangeList(pendNotification).getRanges();
  console.log("findAll in ["+ stop()+ "]ms")
  col = columnNameMapForRange(COL_DEF_NOTIFICATION);

  //"回報中"ステータスの回報のそれぞれに対して、Slackの投稿を再取得して更新を反映する
  for ( let i = 0; i < dataRanges.length; i++ ) {
    let idCell = dataRanges[i].getCell(1,col("回報ID"));
    let link = idCell.getRichTextValue().getLinkUrl();

    if ( link ) {
      let id = idCell.getValue();
      let row = idCell.getRow();
      let ts = slackExtractTSFromArchiveLink(link);
      //Slackの投稿を取得
      notification = slackReadOneMessageFromNotificationChannel(ts)[0];
      console.log(Utilities.formatString("Processing 回報中 Notification id=[%s] row=[%d] slackmessage=[%s]",id,row,JSON.stringify(notification)));
      //回報シートを更新
      let ret = updateRecord(notification.text, notification.user, ts, notification.reactions,id,row);
      if ( ret.status == "回報中" ) {
        results.push( ret );
      }
    } else {
       console.log(Utilities.formatString("WARNING! No hyperlink on 回報中の回報 id[%s]",id))
    }
  }
  return results;
}


/*************************************************************************************
回報の投稿やそこに寄せられたリアクションを解析し、管理簿に回報の新規登録や更新を行う
※　パラメータのうち、reactionsだけはnullable。それ以外は必須入力項目。
*************************************************************************************/
function updateRecord(text, reporterId, ts, reactions,id, rowNumber){
  let newRecord = [];
  let col = columnNameMapForArrayIndex(COL_DEF_NOTIFICATION);

  //回報名を抽出する - 先頭から”回報”の文字までを切り取る。メンションがあれば、以降は余分なものとみなして切り取る
  //TODO: 太字、斜体、取消線は消す。*~_
  let first_line = text.split(/\r\n|\r|\n/)[0]
  title = first_line.
  　　　　　replace(/^[\u20\u3000~_\*]*?回報[\x20\u3000]+/,"").
  　　　　　replace(/[\x20\u3000]*<@[0-9A-Z]+>.*/,"");
  newRecord[col("回報名")]=title;

  //投稿者を特定する
  let reporter = getUserOfficeNameBySlackUserID(reporterId);
  newRecord[col("投稿者")] = reporter;

  //メンションを解析し、回報の確認依頼先メンバーを決める
  // assigneesは、登録メンバーのうち、今回の回報でリアクションをもとめられるメンバーのみを表す
  let assignees = extractAssigneesFromMessage(text);
  //メンションされていないメンバーを非活性にする
  let columnDef = getDefinitionFromCache(COL_DEF_NOTIFICATION);
  if( assignees.length > 0 ) {  //１つ以上のメンションがあれば、メンションされていないメンバーを非活性する
    //メンションされていないメンバーを特定する
    let nonAssignees = Object.keys(columnDef).filter(e => columnDef[e][1] == "member" && -1 == assignees.indexOf(e));
    //管理簿上で、非活性メンバーをグレーアウトする
    if ( nonAssignees.length > 0 ) { //シートを更新する必要がなければ処理をスキップ。スキップしないとsheet.getRange()がエラーになるため。
      nonAssignees.forEach(e=>newRecord[col(e)] = "／");
    }
  }

  //リアクションを反映する
  //signaturesは、リアクションを”印”に変換したもの。ただし、ユーザ定義簿に未登録のメンバーによるリアクションは除外されている。
  let signatures =  extractReactions(reactions);
  for ( let e of Object.keys(signatures) ) {
    if ( newRecord[col(e)] != "／" ) {
      newRecord[col(e)] = signatures[e];
    }
  }

  //ステータスを設定。確認依頼先メンバーが全員確認済みであればクローズ
  let status = "回報中";
  if ( assignees.every( e => newRecord[col(e)] != null ) ) {
    status = "完了";
  }
  newRecord[col("ステータス")] = status;

  let pendAssignees = assignees.filter(e => newRecord[col(e)] == null );

  //作成日を設定。Slackの投稿を特定するIDであるtsの一部を用いる。
  let creationDateTime = Number(ts.replace(/\.\d+/,"")) * 1000;
  newRecord[col("作成日")] = toDateString(new Date(creationDateTime));

  //Slackの投稿へのリンクを取得する。あとで、回報ID欄のリンクとして埋め込むため。
  let channelID = getSlackNotificationChannelID();
  let link = slackLinkToMessage(channelID,ts);

  //Google Spreadsheetを更新する
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NOTIFICATION);
  let idLink = SpreadsheetApp.newRichTextValue()
   .setText(id)
   .setLinkUrl(link)
   .build();

  col = columnNameMapForRange(COL_DEF_NOTIFICATION);

  //TODO: 性能改善のために下の３つを一度に実行できないか？
  let stop = stopWatch();
  //Google Sheetのテキスト設定
  sheet.getRange(rowNumber, 1, 1, newRecord.length).setValues([newRecord]);
  //Google Sheetのセルの背景色の変更 ー　全角スラッシュは背景色グレーとして決め打ちする
  let bgColor = newRecord.map(e=> e == "／" ? "lightgrey" : null );
  sheet.getRange(rowNumber, 1, 1, bgColor.length).setBackgrounds([bgColor]);
  //Google Sheetのハイパーリンクの設定
  sheet.getRange(rowNumber, col("回報ID")).setRichTextValue(idLink);　
  console.log("Wrote in Spredsheet in ["+ stop()+ "]ms")

  let ret = {id:id,link:link,title:title,status:status, pendAssignees:pendAssignees,creationDateTime:toDateShortString(new Date(creationDateTime))};
  console.log("updateRecord() results ["+JSON.stringify(ret) + "]");
  return ret;
}




/*************************************************************************************
Slackの投稿メッセージ内に埋め込まれたメンションを解析し、回報の依頼先メンバー一覧を返却する。
投稿メッセージ内にメンションがない場合、その回報の依頼先は管理簿に登録されたすべてのメンバーとする。
*************************************************************************************/
function extractAssigneesFromMessage(text){
  let assignees = [];
  //1行目をぬきとる
  let first_line = text.split(/\r\n|\r|\n/)[0]
  //GoogleSheetのdef_memberと突き合わせてユーザ名に変換する
  regexp = /<@([0-9A-Z]+)/g;
  while ( (regexpRet = regexp.exec(first_line)) != null ) {
    let user_name = getUserOfficeNameBySlackUserID(RegExp.$1);
    //管理簿に登録されていないメンション名だと、nullが返却される。管理簿に登録していないユーザは無視する
    if ( user_name ) { 
      assignees.push( user_name )
    }
  }

  if( assignees.length == 0 ) {  //１つもメンションがあれば、"member"として列定義されたユーザすべて設定する
    let columnDef = getDefinitionFromCache(COL_DEF_NOTIFICATION);
    //メンションされていないメンバーを特定する
    assignees = Object.keys(columnDef).filter(e => columnDef[e][1] == "member");
  }
  console.log("extractMentionFromMessage() Extracted User ID " + JSON.stringify(assignees) );
  return assignees;
}

/*************************************************************************************
Slackの投稿メッセージ内に埋め込まれたリアクションを解析し、回報への各メンバーの対応結果を返却する
　・　定数シートに未登録のユーザによるリアクションは無視する
　・　担当者が同じ投稿に対して複数種類のリアクションをした場合、あらかじめ定数シートに定義された優先順位
　　　に従って、一つのリアクションに限定して返却する
　・　定数シートに”*”として登録されたリアクションは”デフォルト”のリアクションを意味する
*************************************************************************************/
function extractReactions(reactions){
  if ( reactions == null ) { return {} };
  //リアクションの追加・削除を反映
  //例：　[{"name":"tada","users":["U9ST58P4L"],"count":1},{"name":"large_blue_circle","users":["U9ST58P4L"],"count":1},{"name":"+1","users":["U9ST58P4L"],"count":1}]}]
  let reactionsDef = getDefinitionFromCache(DEF_REACTION);
  //console.log("DEBUG: reactionsDef: " + JSON.stringify(reactionsDef) );

  //1. 各リアクションに対して事前定義された印を紐づける
  adjustedReactions = reactions.map( e => reactionsDef[e.name] ? 
                        {signature:reactionsDef[e.name][1],users:e.users,priority:parseInt(reactionsDef[e.name][0])} :
                        {signature:reactionsDef["*"][1],   users:e.users,priority:parseInt(reactionsDef["*"][0])} );
  
  //2. 各リアクションを優先度の降順に並び替える。のちの処理で、優先度低い順に更新をかけ、最終的に優先度の高い印が残るようにする
  //   一人のユーザが複数リアクションした場合に対応するため。
  adjustedReactions.sort( function(a,b){
    if(a.priority > b.priority) return -1;
    if(a.priority < b.priority) return 1;
    return 0} );
  //console.log("DEBUG:adjustedReactions: " + JSON.stringify(adjustedReactions) );
  
  let result = {};
  //3. レコードを更新する。優先度の低い順から更新をかけることで、最後に優先度の高い印が残るようにする
  for ( let reaction of adjustedReactions ) {
    //SlackユーザIDからメンバー名を紐づける。該当なしの場合"undefined"が設定されるので注意。
    let userNames = reaction.users.map( e => getUserOfficeNameBySlackUserID(e) );
    //リアクションとメンバー名を紐づける。"undefined"は、事前にfilter()で省く。
    userNames.filter(e => e).forEach( e => result[e] = reaction.signature );
  }

  return result
}

/**
 * 回報管理簿上でもっとも大きな回報IDを特定する。また、重複投稿も検知する。
 * 重複投稿を検知したらnullを返却する。
 * @param {String} linkOriginal --- 重複を検知したいSlack投稿へのリンク
 */
function assignNewNotificationID(linkOriginal) {
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NOTIFICATION);
  let col = columnNameMapForRange(COL_DEF_NOTIFICATION);
  //let data = sheet.getRange(1, col("回報ID"), sheet.getLastRow(), 1).getValues();
  let dataRaw = sheet.getRange(1, col("回報ID"), sheet.getLastRow(), 1).getRichTextValues();
  let data = flat2Dto1D(dataRaw);
  //let ids = data.filter(e => /^K\d\d\d\d$/.test(e));
  let existingData = data.find(e => linkOriginal == e.getLinkUrl());
  //DEBUG: data.forEach(e=>console.log("DEBUG: text="+e.getText()+"  link="+e.getLinkUrl()));

  if ( existingData ) {
    return null;
  }

  let ids = data.filter(e => /^K\d\d\d\d$/.test(e.getText()) ).map(e => e.getText());
  let max_id = "";
  if (ids == null || ids.length == 0) {
    throw new Error("問題発生：Max回報IDの取得失敗");
  } else if (ids.length == 1) {
    max_id = ids[0];
  } else {
    max_id = ids.reduce((a, b) => a > b ? a : b);
  }
  //現状のMAX IDに１追加して、新しいIDを採番する
  let reg_ret = /^K(\d\d\d\d)$/.exec(max_id);
  let new_id = Utilities.formatString("K%04d",parseInt(reg_ret[1]) + 1);
  return new_id;
}
/***********************************************************************************
        　テスト　業務機能系(回報管理簿)
************************************************************************************/
function testIdentifyNotification(){
      let title_raw_string = conv[i].text.replaceAll(/[~_\*]/g,"");
      if ( /^[\u20\u3000]*?回報[\x20\u3000]/.test(title_raw_string)) {
        ret.push( parseNotification(conv[i].text, conv[i].user, conv[i].ts, conv[i].reactions) )
        //ret.push("OK")
      }
}

function testStringManipulation(){
  //1行目を抜き取る処理が、1行しかない文字列を対象しても大丈夫か
  let first_line = "1行しかない文字列".split(/\r\n|\r|\n/)[0]
  console.log(first_line)
}

function testslackReadMessagesFromNotificationChannel(){
  let ret = slackReadMessagesFromNotificationChannel()
  console.log( ret )
}

function testLinkCell(){
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NOTIFICATION);
  let range = sheet.getRange("B3");
  let val = range.getRichTextValue();
  let url = val.getLinkUrl();
  console.log("HyperLink URS set on B3 is ["+ val.getText() + url + "]");
}

function testextractReactions(){
  let userDefinition = {"suzuki":"鈴木","tanaka":"田中","sato":"佐藤"};
  //モックを設定する
  getUserOfficeNameBySlackUserID = function(e){ return userDefinition[e] };
  getDefinitionFromCache = function(def){ return {"ok":["1","1_OK"],"ng":[2,"2_NG"],"*":[999,"999_DEFAULT"] } }

  //優先度の高いリアクションが設定されるか？　未登録のリアクションはデフォルトの印が設定されるか？
  let data = [{"name":"ok","users":["suzuki","sato"]},{"name":"XXXX","users":["suzuki","sato"]}];
  let ret = extractReactions(data);
  console.log("TEST 1: " + JSON.stringify(ret));

  //１ユーザあたり１リアクションの場合
  data = [{"name":"ng","users":["sato"]},{"name":"ok","users":["suzuki"]}];
  ret = extractReactions(data);
  console.log("TEST 2: " + JSON.stringify(ret));

  //ユーザ管理簿にない"unknown"は無視されるか？
  data = [{"name":"ng","users":["suzuki","unkown"]},{"name":"ok","users":["suzuki","unkown"]},{"name":"XXXX","users":["suzuki","unkown"]}];
  ret = extractReactions(data);
  console.log("TEST 3: " + JSON.stringify(ret));

  //ユーザ管理簿にない"unknown"のみの場合は空オブジェクトが返却されるか？
  data = [{"name":"ng","users":["unkown"]},{"name":"ok","users":["unkown"]},{"name":"XXXX","users":["unkown"]}];
  ret = extractReactions(data);
  console.log("TEST 4: " + JSON.stringify(ret));

  //すべて知らないユーザIDとリアクションでも問題はおきないか？
  data = [{"ZZZZ":"ng","users":["unkown"]},{"YYYY":"ok","users":["unkown"]},{"name":"XXXX","users":["unkown"]}];
  ret = extractReactions(data);
  console.log("TEST 5: " + JSON.stringify(ret));
}




function testassignNewNotificationID(){
  let link = "https://gocha-gacha.slack.com/archives/C9SC0KF3K/p1625916353001100";
  let ret = assignNewNotificationID(link);
  console.log("TEST 1: "+ ret);

  link = "https://gocha-gacha.slack.com/archives/C9SC0KF3K/UNKNOWN";
  ret = assignNewNotificationID(link);
  console.log("TEST 2: "+ ret);

}
