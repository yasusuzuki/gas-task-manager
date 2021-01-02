

function listTask(){
  var taskSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TASK);
  var data = [], pendRowNo = [], dataRanges;
  var col = columnNameMapForA1Notation();
  //対応中、着手指示待ちの行番号を抽出する
  var lastRow = taskSheet.getLastRow().toString();
  var finder = taskSheet
      .getRange(col("ステータス") + "1:" + col("ステータス") +lastRow)
      .createTextFinder("(対応中|着手指示待ち)")
      .useRegularExpression(true);
  //抽出した行番号に対応した行のデータを抽出する。
  var stop = stopWatch();
  finder.findAll().forEach( e => pendRowNo.push("A"+ e.getRow()+":" + convertToLetter(taskSheet.getLastColumn()) + e.getRow()) );
  if ( pendRowNo.length == 0 ) { return {dueToday:{}, dueNextBusDay:{}, pendAssign:{}} }
  console.log("findAll in listTask() completed in " + stop() + "sec");
  stop = stopWatch();
  dataRanges = taskSheet.getRangeList(pendRowNo).getRanges();
  dataRanges.forEach( e => data.push( e.getValues()[0] ) );
  console.log("getRangeList in listTask() completed in " + stop() + "sec");
  
  var thisFriday = toDateString(getComingFriday(new Date(),0));
  var nextFriday = toDateString(getComingFriday(new Date(),1));
  var nextNextFriday = toDateString(getComingFriday(new Date(),2));
  var col = columnNameMapForArrayIndex();
  var dueToday = [], dueNextBusDay = [], pendAssign = [], weekly = [0,0,0,0];
  for ( var i = 0; i < data.length; i++) {
    var taskID = data[i][col("タスクID")];
    var dueDate = data[i][col("期日")];
    var dueDateStr = toDateString(dueDate);
    if ( ! (dueDate instanceof Date) && (data[i][col("正式期限")] instanceof Date)) {
      dueDate = data[i][col("正式期限")];
      updateLogSheet("データエラー：期日が未設定、もしくはDate型ではないですが正式期限は妥当な値です at listTask() taskID["+taskID+"] dueDate["+dueDate+"]");
    }
    if ( ! (dueDate instanceof Date) ) {
      updateLogSheet("データエラー：期日(および正式期限)が未設定、もしくはDate型ではない at listTask() taskID["+taskID+"] dueDate["+dueDate+"]");
      continue;
    }
    var busDaysToDueDate = diffWorkingDays(new Date(),dueDate);
    var status = data[i][col("ステータス")];
    console.log("listTask() processing taskID:"+taskID+" 期日:"+dueDateStr+" ステータス:"+status);

    if ( status == "着手指示待ち") {
      pendAssign.push(data[i]);
    }else if( busDaysToDueDate <= 0 ) {    //YYYY/MM/DD形式で統一しているので、辞書順の大小比較で日付の前後を判定可能
      dueToday.push(data[i]);
    } else if ( busDaysToDueDate == 1 ) {
      dueNextBusDay.push(data[i]);
    } 
    
    
    if( dueDateStr <= thisFriday ){
      weekly[0]++; 
    } else if( dueDateStr <= nextFriday ){
      weekly[1]++;
    } else if( dueDateStr <= nextNextFriday ) {
      weekly[2]++;
    } else {
      weekly[3]++;
    }
  }

  return {dueToday:dueToday, dueNextBusDay: dueNextBusDay, pendAssign: pendAssign, weekly: weekly};
}


function getReleaseEnvironment(){
  var columnDef = getDefinitionFromCache(DEF_APP_CONFIG);
  var env = columnDef["ENV_DEV_OR_PROD"][0];
  if (! env) {throw new Error("問題発生：ENV_DEV_OR_PRODが定数シートに登録されていません")}
  if ( env == "DEV" || env == "PROD"){
    return env;
  } else {
    throw new Error("問題発生：ENV_DEV_OR_PRODが定数シートに登録されていません");
  }
}
function getSlackBotAppToken(){
  var columnDef = getDefinitionFromCache(DEF_APP_CONFIG);
  if (! columnDef["SLACK_APP_TOKEN"]) {throw new Error("問題発生：SLACK_APP_TOKENが定数シートに登録されていません")}
  return columnDef["SLACK_APP_TOKEN"][0]; 
}
function getSlackTeamChannelID(){
  var columnDef = getDefinitionFromCache(DEF_APP_CONFIG);
  if (! columnDef["SLACK_TEAM_CHANNEL"]) {throw new Error("問題発生：SLACK_TEAM_CHANNELが定数シートに登録されていません")}
  return columnDef["SLACK_TEAM_CHANNEL"][0];
}
function getSlackDeveloperID(){
  var columnDef = getDefinitionFromCache(DEF_APP_CONFIG);
  if (! columnDef["DEVELOPER_SLACK_ID"]) {throw new Error("問題発生：DEVELOPER_SLACK_IDが定数シートに登録されていません")}
  return columnDef["DEVELOPER_SLACK_ID"][0];
}

//メッセージ送信　- chat.postMessageの使用
// - 必要なスコープはBot Token Scopesの　chat:write
function slackSendMessageToChannel(channelID,message){
  
  var messagePayload = {
    "token": getSlackBotAppToken(),  //開発時(Incoming Webhooks)はこちらをコメントアウト
    "channel": channelID,
    "blocks":  message,
  };
  var messageOptions = {
    "method" : "post",
    "contentType": "application/x-www-form-urlencoded",
    //"contentType": "application/json",  <-- 通常はこちらだが、上記でずっと試していたので。。
    "payload" : messagePayload
  }; 
  
  var ret = JSON.parse(UrlFetchApp.fetch("https://slack.com/api/chat.postMessage", messageOptions));
  if(ret.ok == false){ 
    throw new Error("問題発生：Slack メッセージ送信に失敗。チャンネルID["+channelID+"]"+JSON.stringify(ret));
  } else {
    return; 
  }
}

function slackSendMessageToTeam(message){
  if( getReleaseEnvironment() == "PROD" ){
    slackSendMessageToChannel(getSlackTeamChannelID(),message);
  } else if ( getReleaseEnvironment() == "DEV" ){
    var channelID = slackConversationOpenByUserID(getSlackDeveloperID());
    slackSendMessageToChannel(channelID,message);
  }
}

//メッセージ送信　- Incoming-Webhooksの使用
// - Slack APP HOme → Features → Incoming-Webhooksを選択し、Webhook URLからURLをコピーして、第一引数に張り付ける。
// - 必要なスコープはBot Token Scopesの　chat:write
function slackSendMessageToWebhooks(message){
  var messagePayload = {//incoming webhooks はtokenやチャネルは不要
    "blocks":  message,
  };
  var messageOptions = {
    "method" : "post",
    "contentType": "application/x-www-form-urlencoded",
    //"contentType": "application/json",  <-- 通常はこちらだが、上記でずっと試していたので。。
    "payload" : JSON.stringify(messagePayload)   //Incoming Webhooksはstringifyする
  }; 
  var ret = JSON.parse(UrlFetchApp.fetch(getSlackIncomingWebhooksURL(), messageOptions));
  if(ret.ok == false){ 
    throw new Error("問題発生：Slack メッセージ送信に失敗。チャンネルID["+channelID+"]"+JSON.stringify(ret));
  } else {
    return; 
  }
}

function getSlackIncomingWebhooksURL(){
  var columnDef = getDefinitionFromCache(DEF_APP_CONFIG);
  if (! columnDef["IN_WEBHOOKS_URL"]) {throw new Error("問題発生：SLACK_APP_TOKENが定数シートに登録されていません")}
  return columnDef["IN_WEBHOOKS_URL"][0]; 
}


//メッセージの読み取り -  conversations.historyの使用
// - 必要なスコープはBot Token Scopesの　channels:read,im:read (groups:read or mpim:read)
// ()内はこのSlack Appでは利用しない
function slackReadMessages(channelID){
      
  var messagePayload = {
    "token": getSlackBotAppToken(),
    "channel": channelID,
    "limit": 30,
  };
  var last_ts = getLastSlackMessageTS();
  if ( last_ts == null ) {
    messagePayload["limit"] = 1;
  } else if ( /^\d+\.\d+$/.test(last_ts) ) {
    messagePayload["oldest"] = last_ts;
  } else {
    throw new Error("問題発生:プロパティに設定されている最後のメッセージTSが不正です["+last_ts+"]");
  }
  var messageOptions = {
    "method" : "get",
    "contentType": "application/x-www-form-urlencoded",
    "payload" : messagePayload
  }; 
  console.log("slack read :" + JSON.stringify(messageOptions));
  var ret = JSON.parse(UrlFetchApp.fetch("https://slack.com/api/conversations.history", messageOptions));
  if(ret.ok == false){ 
    throw new Error("問題発生：Slack メッセージ受信に失敗。チャンネルID["+channelID+"]"+JSON.stringify(ret));
  } else {
    var data = [];
    ret.messages.forEach(e => data.push({text:e.text, user:e.user, ts:e.ts}));
    return data;
  }
}

function getLastSlackMessageTS(){  
  //スクリプトプロパティの値を取得
  var env = getReleaseEnvironment();
  var prop = PropertiesService.getScriptProperties();
  var res = prop.getProperty("LAST_SLACK_MESSAGE_TS_"+env);
  return res; 
}

function setLastSlackMessageTS(last_message_ts){  
  //スクリプトプロパティの値を取得
  var env = getReleaseEnvironment();
  var prop = PropertiesService.getScriptProperties();
  prop.setProperty("LAST_SLACK_MESSAGE_TS_"+env, last_message_ts);
}

function slackReadMessagesFromTeamChannel(){
  if( getReleaseEnvironment() == "PROD" ){
    return slackReadMessages(getSlackTeamChannelID());
  } else if ( getReleaseEnvironment() == "DEV" ){
    var channelID = slackConversationOpenByUserID(getSlackDeveloperID());
    return slackReadMessages(channelID);
  }
}



// 別メッセージへのリンク作成 - chat.getPermalinkの使用
// - 必要なスコープはBot Token Scopesの　channels:read,im:read ( groups:read,  or mpim:read )
// ()内はこのSlack Appでは利用しない
function slackLinkToMessage(channelID,message_ts){
  

  var messagePayload = {
    "token": getSlackBotAppToken(),
    "channel": channelID,
    "message_ts": message_ts,
  };
  var messageOptions = {
    "method" : "get",
    "contentType": "application/x-www-form-urlencoded",
    "payload" : messagePayload
  }; 
  
  var ret = JSON.parse(UrlFetchApp.fetch("https://slack.com/api/chat.getPermalink", messageOptions));
  if(ret.ok == false){ 
    throw new Error("問題発生：Slack メッセージ参照に失敗。チャンネルID["+channelID+"]"+JSON.stringify(ret));
  } else {
    return ret.permalink; 
  }
}

function slackLinkToTeamMessage(message_ts){
  if( getReleaseEnvironment() == "PROD" ){
    return slackLinkToMessage(getSlackTeamChannelID(),message_ts);
  } else if ( getReleaseEnvironment() == "DEV" ){
    var channelID = slackConversationOpenByUserID(getSlackDeveloperID());
    return slackLinkToMessage(channelID,message_ts);
  }
}

//userIDからチャンネルIDを特定し、会話を開局する
//userIDに対して１対１のメッセージを送信することを"DM"と呼ぶ。
//DMを送れるのは、通常のユーザだけで、Botに対してメッセージ送信するとエラーになる
//ただし、実験したところ、会話の開局をしなくても、エラーにならなかったので、会話の開局は不要かもしれない
// im.openは非推奨となっており、conversation.open APIを利用する必要がある。
// - 必要なスコープはBot Token Scopesのim:write
function slackConversationOpenByUserID(userID){
  // - ユーザ名ではなくユーザIDしか受け付けない
  // - https://api.slack.com/changelog/2017-09-the-one-about-usernames
  var imPayload = {
    "token": getSlackBotAppToken(), 
    "users": userID,   //DM相手のSlackユーザーID（@とかはいらない）,
  };
  
  var imOptions ={
    "method" : "post",
    "contentType": "application/x-www-form-urlencoded",
    "payload" : imPayload
  };

  var ret = JSON.parse(UrlFetchApp.fetch("https://slack.com/api/conversations.open", imOptions));
  if(ret.ok == false ){ 
    throw new Error("問題発生：Slack チャンネルの開局に失敗。ユーザID["+userID+"]");
  } else {
    return ret.channel.id; 
  }
}




//Slackへの返却用のJSONフォーマットに変換
function buildResponse(json){
  return ContentService.createTextOutput(JSON.stringify(json)).setMimeType(ContentService.MimeType.JSON)
}

//Slackへの返却用のJSONフォーマットに変換
function buildErrorResponse(message){
  var data = {
    "text": "問題発生！", //アタッチメントではない通常メッセージ
    //"response_type":"ephemeral", // ここを"ephemeral"から"in_chanel"に変えると他の人にも表示されるらしい（？）
    //アタッチメント部分
    "attachments": [{
      "title": "原因：",//　アタッチメントのタイトル
      "text": message,//アタッチメント内テキスト
      "color": "#FF4F50", //左の棒の色を指定する
      "attachment_type": "default",
      }]
  };
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}


//入れ子の子孫を直接アクセスすると、途中の要素が無い場合、以下のエラーが発生してしまう。
//   Cannot read property '〇〇' of undefined
//そこで入れ子の子孫へアクセスする前に、１つ１つ要素の有無をチェックする必要がある
//https://tonari-it.com/gas-spreadsheet-find/#toc5
function hasNestedKey(obj, level,  ...rest) {
  if (obj === undefined) return false
  if (rest.length == 0 && obj.hasOwnProperty(level)) return true
  return hasNestedKey(obj[level], ...rest)
}





function redmineToLink(text){
  if ( ! text ){
    return "#______";
  } else if ( /\#\d+/.test(text) ) {
    //URLを組み立てるために番号部分以外は削除
    text = text.replace(/^\s*#|\s*$/,"");
    //ただし、表示名称は読みやすくするために#をつけなおす
    return "<http://aitpmtrmweb02/redmine/issues/"+text+"|#"+text+">" 
  } else {
    return text;
  }
}


//Sheet.getRangeList()関数は引数にA1記法しか受け入れてくれない　例：["A1:A2","B10:B11"]
//どうしてもA1記法が必要な場合に使う関数
function columnNameMapForA1Notation(){
  var columnDefTask = getDefinitionFromCache(DEF_COLUMN_TASK);
  var ret = {};
  Object.keys(columnDefTask).forEach( e => ret[e] = convertToLetter( Number(columnDefTask[e][0])+1) );
  return function(key){
    if ( ret[key] == null ){ throw new Error("問題発生：未定義のキー["+key+"]で定数データを取得しようとしました") }
    return ret[key];
  };
}
//Sheet.getRange(row,col)などで取得する場合、列番号は１から始まる
//そのため、＋１する必要がある
function columnNameMapForRange(){
  var columnDefTask = getDefinitionFromCache(DEF_COLUMN_TASK);
  var ret = {};
  Object.keys(columnDefTask).forEach( e => ret[e] = Number(columnDefTask[e][0]) + 1 );
  return function(key){
    if ( ret[key] == null ){ throw new Error("問題発生：未定義のキー["+key+"]で定数データを取得しようとしました") }
    return ret[key];
  };
}
//Range.getValues()などで取得した２次元配列の場合、列番号は０から始まる
function columnNameMapForArrayIndex(){
  var columnDefTask = getDefinitionFromCache(DEF_COLUMN_TASK);
  var ret = {};
  Object.keys(columnDefTask).forEach( e => ret[e] = Number(columnDefTask[e][0]) );
  return function(key){
    if ( ret[key] == null ){ throw new Error("問題発生：未定義のキー["+key+"]で定数データを取得しようとしました") }
    return ret[key];
  };
}

function convertToLetter(columnNumber) {
  if( columnNumber < 1) { throw new Error("パラメータcolumnNumberは1以上でなければいけません")}
  var alpha, remainder,ret="";
  alpha = parseInt(columnNumber / 27);
  remainder = columnNumber - (alpha * 26);
  if ( alpha > 0 ) {
    ret = String.fromCharCode(alpha + 64);
  }
  if ( remainder > 0 ) {
    ret = ret + String.fromCharCode(remainder + 64)
  }
  return ret;
}



function getUserOfficeNameBySlackUserID(slackUserID){
  var columnDefTask = getDefinitionFromCache(DEF_MEMBER);
  var ret = Object.keys(columnDefTask).filter( e => columnDefTask[e][1] == slackUserID );
  if( ret.length == 0 ){
    return null;
  } else if (ret.length == 1){
    return ret[0];
  } else {
    throw new Error("問題発生：SlackユーザID["+slackUserID+"]に対して複数のユーザが定義されています"); 
  }
}                


function getUserEmailAddresses(){
  var columnDefTask = getDefinitionFromCache(DEF_MEMBER);
  var emailAddresses = Object.keys(columnDefTask)
        .map( e => columnDefTask[e][0] )
        .filter( e => /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/.test(e))
  return emailAddresses;
}

function getDefinitionFromCache(category){
  const cacheService = CacheService.getScriptCache();
  var cache = cacheService.get(category);
  if ( cache == null ) {
    //定数シート全体を一度だけ読み込む
    var defSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_DEF);
    var dataValues = defSheet.getDataRange().getValues();
    
    for( var i=0; i<DEF_ITEM_LIST.length; i++){
      cache = {};
      if ( DEF_ITEM_LIST[i] == DEF_HOLIDAYS ){
        var data2d = SpreadsheetApp.getActiveSpreadsheet().getRangeByName('祝日').getValues();
        var holidays   = flat2Dto1D(data2d);  //flat化。2次元配列を１次元配列へ
        holidays.forEach( e => cache[ toDateString(e) ] = true);
      } else {
        for(var j = 0; j<dataValues.length; j++){
          if ( dataValues[j][0] == DEF_ITEM_LIST[i] ) {
            cache[dataValues[j][1].toString()] = [ dataValues[j][2],dataValues[j][3],dataValues[j][4] ];
          }
        }
      }
      cacheService.put(DEF_ITEM_LIST[i], JSON.stringify(cache), 21600); //約6時間キャッシュする
    }
  }
  return JSON.parse(cacheService.get(category));
  
}


/**********************  Sheet系  **************************/
function getARowRangeForUpdate(rowNumber){
  var taskSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TASK);
  var ret = taskSheet.getRange(rowNumber,1,1,taskSheet.getLastColumn());
  if ( ret == null )  { throw new Error("問題発生：Rangeの取得に失敗しました")}
  return ret;
}

function findRowByTaskID(taskID){ 
  var data = [], pendRowNo = [], finder, dataRanges;
  var taskSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TASK);

  var col = columnNameMapForA1Notation();
  var lastRow = taskSheet.getLastRow().toString();
  //T900 を T0900へ整形
  var normalizedTaskID = taskID.replace(/^([tT])(\d\d\d)$/,"$10$2");
  
  finder = taskSheet.getRange(col("タスクID") + "1:" + col("タスクID") + lastRow)
          .createTextFinder(normalizedTaskID).useRegularExpression(true);  
  //重複して同じタスクIDが存在したら最初のものを取得する。ただし、タスクIDは重複しない前提
  
  var ret =  finder.findNext();
  if ( ret != null ) {
    return ret.getRow();
  } else {
    return null;
  }
}

function findMaxTaskID(){
  var taskSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TASK);
  var col = columnNameMapForRange();
  var data = taskSheet.getRange(1,col("タスクID"),taskSheet.getLastRow(),1).getValues();
  var taskIds = data.filter( e => /^[tT]\d\d\d\d$/.test(e) );
  if ( taskIds == null || taskIds.length == 0  ) {
    throw new Error("問題発生：MaxタスクIDの取得失敗");
  } else if ( taskIds.length == 1 ) {
    return taskIds[0]; 
  } else {
    return taskIds.reduce((a,b)=> a>b ? a : b);
  }
}

function updateLogSheet(comment){
  var logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SYSTEM_LOG);
  var maxRowIndex = logSheet.getDataRange().getLastRow();
  var col=1;
  var row = maxRowIndex+1;
  logSheet.getRange(row,col++).setValue( toTimestamp(new Date()) );
  logSheet.getRange(row,col++).setValue( comment );
}

function insertUserActionLogSheet(user, action, taskID, message){
  var logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERACTION_LOG);
  var maxRowIndex = logSheet.getDataRange().getLastRow();
  updateUserActionLogSheet(maxRowIndex+1,user,action,taskID, message);
}

function updateUserActionLogSheet(id, user, action, taskID, message){
  var logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERACTION_LOG);
  var col=1;
  var row = id;
  var timeStamp = toTimestamp(new Date());
  var data = [[id, timeStamp, user, action, taskID, message ]] ;
  
  logSheet.getRange(row,col,1,6).setValues( data );
}


/*
Range単位のプロテクションとSheet単位のプロテクションがあるが、Range単位のほうが処理が遅くなるので
Sheet単位のプロテクション方式とする。Range＝＞2.19秒 Sheet=> 1.35秒

プロテクションをかけると、同時に編集していたメンバーは、即時編集ができなくり、編集しようとすると、
以下のエラーによって編集ができなくなる
　　問題が発生しました
　　保護されているセルやオブジェクトを編集しようとしています。編集する必要がある場合は、
  　スプレッドシートのオーナーに連絡して、保護を解除してもらってください。

もしも別ユーザがプロテクションをすでにかけていた場合、
   →範囲が異なっていても、重複する部分にプロテクションがかかる。
   →このスクリプトはオーナー権限による実行となるため、設定済みのプロテクションよりも強力
   　そのため、例え別ユーザがすでにプロテクションをかけていたとしてもこのスクリプトがプロテクションを
     追加すると、そのユーザは編集ができなくなる。
*/
function protectTaskSheet(){
  console.log("protectRange() start"); var stop = stopWatch();
  //var protection = range.protect().setDescription('m(_ _)m タスク管理Botが編集中です');
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TASK);
  var protection = sheet.protect().setDescription('m(_ _)m タスク管理Botが編集中です');
  var me = Session.getEffectiveUser();
  protection.addEditor(me);
  var editors = protection.getEditors().map( e => e.getEmail());
  protection.removeEditors(editors);
  var editors = protection.getEditors().map( e => e.getEmail());
  if (protection.canDomainEdit()) {
    protection.setDomainEdit(false);
  }
  console.log("protectRange() finished in " + stop() + "ms");
}
function removeProtection(){
  console.log("removeProtection() start"); var stop = stopWatch();
  //var protections = SpreadsheetApp.getActiveSpreadsheet().getProtections(SpreadsheetApp.ProtectionType.RANGE);
  var protections = SpreadsheetApp.getActiveSpreadsheet().getProtections(SpreadsheetApp.ProtectionType.SHEET);
  //TODO: 以下の処理だと、このスクリプトが作成したプロテクション以外も削除してしまう。
  for (var i = 0; i < protections.length; i++) {
    var protection = protections[i];
    if (protection.canEdit()) {
      protection.remove();
    }
  }
  console.log("removeProtection() finished in " + stop() + "ms");
}

/**********************  文字列・日付・数値・配列加工系  **************************/

function toTimestamp( date ){
  if ( ! (date instanceof Date) )  { throw new Error("問題発生：toTimestamp()のパラメータはDate型でなければいけません")}
  return Utilities.formatDate(date, "JST", "yyyy/MM/dd HH:mm:ss");
}

function toDateString( date ){
  if ( date instanceof Date )  { 
    return Utilities.formatDate(date, "JST", "yyyy/MM/dd");
  } else {
    return "____/__/__";
  }  

}


function toDateShortString( date ) {
  if ( date instanceof Date )  { 
    return Utilities.formatDate(date, "JST", "MM/dd");
  } else {
    return "__/__";
  }  
}
//flat化。2次元配列を１次元配列へ。正確には１次元削除
//
// [ [a,b,c], [d,e,f], [g,h,i] ] --> [a,b,c,d,e,f,g,h,i]
function flat2Dto1D( array ) {
  return array.reduce((acc, val) => acc.concat(val), []);
}

//今週末のDateを取得する
//https://codereview.stackexchange.com/questions/33527/find-next-occurring-friday-or-any-dayofweek
function getNextDayOfWeek(date, dayOfWeek) {
  if ( ! (date instanceof Date) )  { throw new Error("問題発生：getNextDayOfWeek()のパラメータdateはDate型でなければいけません")}
  var resultDate = new Date(date.valueOf());
  resultDate.setDate(date.getDate() + (7 + dayOfWeek - date.getDay() ) % 7);
  return resultDate;
}
//weeks=0は、今週の金曜日。weeks=1は、来週の金曜日
function getComingFriday(date,weeks) {
  if ( ! (date instanceof Date) )  { throw new Error("問題発生：getComingFriday()のパラメータdateはDate型でなければいけません")}
  var d = new Date(date.valueOf());
  d.setDate( d.getDate() + weeks*7);
  return getNextDayOfWeek(d, 5);
}


//土日・祝日の考慮なしのdateDiff
function dateDiff(startDate, endDate){
  if ( ! (startDate instanceof Date) )  { throw new Error("問題発生：dateDiff()のパラメータstartDateはDate型でなければいけません")}
  if ( ! (endDate instanceof Date) )  { throw new Error("問題発生：dateDiff()のパラメータendDateはDate型でなければいけません")}
  //Google Sheetで2020/12/14と入力すると、なぜか ”Thu Dec 24 2020 17:00:00 GMT+0900 (Japan Standard Time)”となり
  //new Date("2020/12/24")として取得した”Thu Dec 24 2020 00:00:00 GMT+0900 (Japan Standard Time) ”と差異がでてしまう。
  //そこで、同じ基準に事前にならしておく必要がある。
  var cleanStartDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  var cleanendDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  return Math.floor((cleanendDate.valueOf() - cleanStartDate.valueOf())/(24*3600*1000));
}

function stopWatch(){
  //開始時間を取得する
  var sttime = new Date();
  
  //終了時間用の変数
  var edtime = "";
  return function(){
    edtime = new Date();
    return (edtime - sttime)/1000;
  }
}


function diffWorkingDays(startDate, endDate){
  if ( ! (startDate instanceof Date) )  { throw new Error("問題発生：diffWorkingDays()のパラメータstartDateはDate型でなければいけません")}
  if ( ! (endDate instanceof Date) )  { throw new Error("問題発生：diffWorkingDays()のパラメータendDateはDate型でなければいけません")}
  var currentDate = startDate;
  var numberOfDays=0;  //startDate==endDateの場合、結果は0となる
  if ( dateDiff(startDate,endDate) < 0 ){ //startDateがendDateを追い越してしまった場合
    while ( dateDiff(currentDate,endDate) <0  ){
      currentDate.setDate( currentDate.getDate() - 1);
      while( ! isBusinessDay(currentDate) ){
        currentDate.setDate( currentDate.getDate() - 1);
      }
      numberOfDays--;
    }  
  } else {
    while ( dateDiff(currentDate,endDate) > 0  ){
      currentDate.setDate( currentDate.getDate() + 1);
      while( ! isBusinessDay(currentDate) ){
        currentDate.setDate( currentDate.getDate() + 1);
      }
      numberOfDays++;
    }  
  }
  return numberOfDays;
}

function getNextWorkDays(count, startDate){
  if ( count < 0 ) { throw new Error("問題発生：getNextWorkDays()は加算のみ対応しています")}
  if ( ! (startDate instanceof Date) )  { throw new Error("問題発生：getNextWorkDays()のパラメータstartDateはDate型でなければいけません")}
  var day = new Date(startDate.valueOf());
  for ( var i =0; i<count;i++){
    day.setDate( day.getDate() + 1);
    while( ! isBusinessDay(day) ){
      day.setDate( day.getDate() + 1);
    }
  }
  return day;
}

function isBusinessDay(date){
  if ( ! (date instanceof Date) )  { throw new Error("問題発生：getNextWorkDays()のパラメータstartDateはDate型でなければいけません")}
  //土日ならば休み
  if (date.getDay() == 0 || date.getDay() == 6) {
    return false;
  }
  //祝日ならば休み
  var dateString = toDateString(date);
  var holidays = getDefinitionFromCache(DEF_HOLIDAYS);
  if( holidays[dateString] == true ) { return false} 
  
  //インターネットではうまくいく記事があったが、社内ではアクセスできず機能しない
  //var holidayCal = CalendarApp.getCalendarById('ja.japanese#holiday@group.v.calendar.google.com');
  //
  //if(holidayCal.getEventsForDay(date).length > 0){
  //  return false;
  //}
  return true;
}