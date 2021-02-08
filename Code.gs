//管理簿上のシート名：　”タスク管理簿シート”、”システムログシート”、”ユーザログシート”、”定数シート”
const [SHEET_TASK,SHEET_SYSTEM_LOG,SHEET_USERACTION_LOG,SHEET_DEF] = ["期限管理","SystemLog","UserLog","def"];
//定数シート内のカテゴリ：　タスク管理簿の列定義、メンバー定義、アプリ設定、祝日設定
const [DEF_COLUMN_TASK,DEF_MEMBER,DEF_APP_CONFIG,DEF_HOLIDAYS] = ["col_def_task","def_member","def_app_config","def_holidays"];
const DEF_ITEM_LIST = [DEF_COLUMN_TASK,DEF_MEMBER,DEF_APP_CONFIG,DEF_HOLIDAYS];
const DOCUMENT_ID = "1jVXk7dFdn7fQWStyc3L5_dDXhp8ov75WecOth2msAUI";
const DOCUMENT_URL = "https://docs.google.com/spreadsheets/d/1jVXk7dFdn7fQWStyc3L5_dDXhp8ov75WecOth2msAUI/edit#gid=577452844"
const REDMINE_HOST = "aitpmtrmweb02";


/***************************************************************************
  定数シートを変更した後（DEV<->PROD環境のスイッチ、祝日やメンバーの登録など）に実行する必要のある関数
  基本的にリリースする度に実行したほうがよい。
  キャッシュをクリアしたりする
****************************************************************************/
function reset(){
  //Cacheをすべてクリア
  DEF_ITEM_LIST.forEach( e => CacheService.getScriptCache().remove(e)); 
  let env = getReleaseEnvironment();
  let prop = PropertiesService.getScriptProperties();
  console.log("Env before: "+ prop.getProperty("ENV"));
  prop.setProperty("ENV", env);
  console.log("Env after: "+ prop.getProperty("ENV"));
  updateLogSheet("reset()　キャッシュをクリアして設定を再読み込みします。読み込み後の環境["+prop.getProperty("ENV")+"]"); 
}

/***************************************************************************
 定期実行のエントリーポイント。一日一回朝の7時～8時に実行する
 管理簿に登録されたタスクのうち、近日中に期限がくるもの、タスク担当者が決まっていないもの
 などを抽出して報告する。

 注意：Google Sheetのセルは、Number,String,Dateのいずれかなので、String系の機能を使う場合は、事前にStringにキャストするように。
****************************************************************************/
function dailyMorningJob(){
  summaryReport();
  sanityCheck();
}

function sanityCheck(){
  let taskSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TASK);
  let col = columnNameMapForA1Notation();
  let lastRow = taskSheet.getLastRow().toString();
  let stop = stopWatch();
  let taskIDs2D = taskSheet
      .getRange(col("タスクID") + "6:" + col("タスクID") +lastRow)
      .getValues();
  console.log("findAll in listTask() completed in " + stop() + "sec");
  let taskIDs = flat2Dto1D(taskIDs2D);
  let lastCell = taskIDs.pop();
  while(lastCell == ""){ 
    lastCell = taskIDs.pop()
  }
  taskIDs.push( lastCell );
  
  let uniqueIDs = {}; //blank hash
  let dupeIDs = {}; //blank array
  taskIDs.forEach( e => ( uniqueIDs[e] ) ? dupeIDs[e] = true : uniqueIDs[e] = true );
  let strangeIDs = taskIDs.filter( e => ! /^[tT]\d\d\d\d$/.test(e) );
  strangeIDs.forEach( e => console.log("["+e+"] "));
  
  let text = "";
  if ( Object.keys(dupeIDs).length > 0 ){
    text = text + ":warning:*重複したタスクIDを検出*\n" + Object.keys(dupeIDs).join("\n") + "\n";
  }
  if ( strangeIDs.length > 0 ){
    text = text + ":warning:*不正なタスクIDを検出*　～正しくはTまたはtの後に４桁の数字。すべて半角英数。～\n" + strangeIDs.join("\n");
  }
  if ( text ){
    let message = [{"type": "section","text": {"type": "mrkdwn","text":text}}];
   slackSendMessageToTeam(JSON.stringify(message));
  }

}

function summaryReport(){
  updateLogSheet("summaryReport()を開始します。");
  let data = listTask();
  let col = columnNameMapForArrayIndex();
  let text = [];
  text.push("<"+DOCUMENT_URL+"|要回答など期限管理>");
  text.push("  今週["+data.weekly[0]+"]->翌週["+data.weekly[1]+"]->翌々週["+data.weekly[2]+"]->以降["+data.weekly[3]+"] \n");
  
  
  text.push("*期限到来済み* \n");
  if ( data.dueToday.length == 0 ){text.push("　　ありません\n")}
  for (let i=0; i< data.dueToday.length; i++){
    let dataRow = data.dueToday[i];
    console.log("formatting dueToday taskID:" + dataRow[col("タスクID")]); 
    let taskID = dataRow[col("タスクID")];
    let dueDateStr = toDateShortString(dataRow[col("期日")]);
    let redmine = redmineToLink(dataRow[col("Redmine")]);
    let title = dataRow[col("件名")].toString();
    title = title.replace(/\[.*?\]/,"").replace( /\(回答中\)/,"").split(/\n/)[0].replace( /(.{30})(.*)/,"$1...");
    let assignedOwners = getActualTaskOwners(dataRow);
    let completedOwners = getCompletedTaskOwners(dataRow);
    text.push(Utilities.formatString("  %5s %5s %7s %s\n",taskID,dueDateStr,redmine,title) );
    text.push(Utilities.formatString("     -  担当者[%s]  完了済[%s]\n",assignedOwners.join(","),completedOwners.join(",")) );
    if ( isCloseable(completedOwners, assignedOwners) ) {
      text.push("     -  全員完了済み。ステータスを「対応中」から「完了」へ変更可能。\n" );
    } 
  }


  text.push("*明日期日* \n");
  if ( data.dueNextBusDay.length == 0 ){text.push("　　ありません\n")}
  for (let i=0; i< data.dueNextBusDay.length; i++){
    let dataRow = data.dueNextBusDay[i];
    console.log("formatting dueNextBusDay taskID:" + dataRow[col("タスクID")]); 
    let taskID = dataRow[col("タスクID")];
    let dueDateStr = toDateShortString(dataRow[col("期日")]);
    let redmine = redmineToLink(dataRow[col("Redmine")]);
    let title = dataRow[col("件名")].toString();
    title = title.replace(/\[.*?\]/,"").replace( /\(回答中\)/,"").split(/\n/)[0].replace( /(.{30})(.*)/,"$1...");
    let assignedOwners = getActualTaskOwners(dataRow);
    text.push(Utilities.formatString("  %5s %5s %7s %s\n",taskID,dueDateStr,redmine,title) );
    text.push(Utilities.formatString("     -  担当者[%s]\n",assignedOwners.join(",")) );
  }

  text.push("*担当者未割当* \n");
  if ( data.pendAssign.length == 0 ){text.push("　　ありません\n")}
  for (let i=0; i< data.pendAssign.length; i++){
    let dataRow = data.pendAssign[i];
    console.log("formatting pendAssign taskID:" + dataRow[col("タスクID")]); 
    let taskID = dataRow[col("タスクID")];
    //期日か正式期限のどちらか設定されていれば、正当データとなるため、期日
    let effectiveDueDate = ((dataRow[col("期日")] instanceof Date) ? dataRow[col("期日")]:dataRow[col("正式期限")] );
    let effectiveDueDateStr = toDateShortString(effectiveDueDate);
    let redmine = redmineToLink(dataRow[col("Redmine")]);
    let title = dataRow[col("件名")].toString();
    title = title.replace(/\[.*?\]/,"").replace( /\(回答中\)/,"").split(/\n/)[0].replace( /(.{30})(.*)/,"$1...");
    //依頼先と了解済みの状況
    let actualOwners = getKKSSAssignedTaskOwners(dataRow);
    let nominatedOwners =getKKSSNominatedTaskOwners(dataRow);
    let readyToGo = isReadyToWork(actualOwners,nominatedOwners);
    text.push(Utilities.formatString("  %5s %5s %7s %s\n",taskID,effectiveDueDateStr,redmine,title) );
    text.push(Utilities.formatString("     -  KKSE・KKZEの依頼先[%s]\n",nominatedOwners.join(",")) );
    text.push(Utilities.formatString("     -  KKSE・KKZEの了解済[%s]\n",actualOwners.join(",")) );    
    if(readyToGo){ text.push("     -  全員了解済み。ステータスを「着手指示待ち」から「対応中」へ変更可能。\n") }

    let requestDate = toDateShortString(dataRow[col("発信日")]);
    let daysSinceRequestDate,daysUntilDueDate;
    if ( dataRow[col("発信日")] instanceof Date ) {
      //抽出時に、期日も正式期限も両方ともDate型でない場合は除外しているので、どちらか一方に必ず妥当な値が設定されているはず
      daysSinceRequestDate = diffWorkingDays(dataRow[col("発信日")], new Date());
      daysUntilDueDate = diffWorkingDays(new Date(),effectiveDueDate);
      let atatameRate  = daysSinceRequestDate/(daysSinceRequestDate+daysUntilDueDate-1);
      text.push(Utilities.formatString("     -  発信日[%s]から[%s]営業日経過　期日まで[%3d]％経過\n"
                  ,requestDate,daysSinceRequestDate,atatameRate*100) );
    } else {
      text.push(Utilities.formatString("     -  発信日が正しく設定されていません\n") );
    }
  }

  //３００１文字以上のメッセージ送信はエラーになってしまうので、メッセージを分割して送信する
  let message_size = 0;
  let message_offset = 0;
  for(let i=0; text.length > i; i++) {
    message_size += text[i].length;
    if( message_size + i - message_offset > 2950 ){ //文字数＋改行数が3001以上にならなければよいが、念のため2950を閾値として設定
      slackSendMessageToTeam(JSON.stringify([{"type": "section","text": {"type": "mrkdwn","text":text.slice(message_offset,i).join("\n")}}]));
      message_offset = i;
      message_size = text[i].length;
    }
  }
  slackSendMessageToTeam(JSON.stringify([{"type": "section","text": {"type": "mrkdwn","text":text.slice(message_offset,text.length).join("\n")}}]));

  //TODO: sendEmail(text);
  updateLogSheet("summaryReport()　完了しました");
}

function sendEmail(text){
  let addresses = getUserEmailAddresses();
  let htmlBody =  HtmlService.createTemplateFromFile('mailbody');
  htmlBody.data  = [["a","b","c"]];
  let htmlBodyText = htmlBody.evaluate();
  /*MailApp.sendEmail({
    to: addresses.join(","),
    subject: 'Test Email markup - ' + new Date(),
    htmlBody: htmlBodyText.getContent(),
  });*/
  console.log(htmlBodyText.getContent());

}

/***************************************************************************
 定期実行のエントリーポイント。１０分～３０分に一回の実行を予定する
 定数シートに設定されたチームのSlackチャネルに投稿された了解コマンドや完了コマンドを取得し
 管理簿を更新する
 
 
 担当タスクの進捗を更新したいときに、このチャネルで”コマンド”を投稿するとBotが代わりに管理簿を
 更新してくれます。”コマンド”全般の書式は以下：
　　　タスクID　アクション名
タスク担当者として宣言する場合のコマンド例。BotがH列「照会証券・共保代分の対応者」にあなたの名前が追加します。
　　　T0836 了解
自分の担当分が完了した場合のコマンド例。BotがS列「メモ」に担当者の完了宣言を追記します。
　　　T0836　完了

”コマンド”の細かいルールは以下のとおり。〇は処理される。×は処理されない。です。
 〇　タスクIDの前に半角/全角スペースがある
 ×　タスクIDとアクション名の間に1つ以上の半角/全角スペースがない
 ×　タスクIDが全角(例：Ｔ０８９６)
 〇　タスクIDが小文字(例：t0896)
 〇　タスクIDの４桁数字のうち最初のゼロ削除(例：T896 了解！)
 〇　アクション名以外の文字が含まれている(例：T0896 完了しました！)
  　　補足：了解と完了が両方含まれていたら、了解を優先
 〇　改行で区切った複数のコマンド。複数のコマンドとして受け付ける
　　　例：T0896　　了解
　　　　　T0997　　完了
 ×　別チャネルや、本チャネルから派生したスレッドに投稿されたコマンド
 ×　管理簿に未登録の担当者によるコマンド投稿
 ×　該当するタスクIDが管理簿にない
 ×　同じ担当者が同じタスクIDに対して同じコマンドを実行済み
****************************************************************************/
function scheduledPollingCommandsFromSlack(){
  updateLogSheet("scheduledPollingCommandsFromSlack()　開始します。");
  console.log("処理前の最終メッセージID["+getLastSlackMessageTS()+"]");
  let conv_orig = slackReadMessagesFromTeamChannel();
  //コマンドが不整合とならないように読み取ったチームチャネルへの投稿を新しい順を古い順に並び替える
  let conv = conv_orig.reverse(); 
  let ret = [];
  //シート全体に他ユーザによる編集を制限するプロテクションをかける
  //このスクリプトの実行者はGoogle Sheetのオーナーという前提であるため、スクリプトがプロテクションをかけると、
  //他ユーザは例えセルを編集中でも締め出される。本来は、細粒度でロックをかけたほうが他のユーザへの影響が少ないが、
  //なんどもロックをかけると性能懸念があるので、ここで実行する。
  protectTaskSheet();  
  try{
    for ( let i=0; i < conv.length; i++ ){
      let tokens = conv[i].text.split(/\n/);
      for ( let j=0; j < tokens.length; j++ ){
        console.log("Reading out slack message - user:%s ts:%d #:%s token:%s"
        ,conv[i].user, conv[i].ts, j, tokens[j] );
        //T0906とT906を両方許容する
        if ( /^[\u20\u3000]*?[tT]\d\d\d\d?[\x20\u3000]/.test(tokens[j])) {
          if ( /了解/.test(tokens[j]) ){
            ret.push( taskack(tokens[j], conv[i].user, conv[i].ts) );
          } else if ( /完了/.test(tokens[j]) ){
            ret.push( taskcomplete(tokens[j], conv[i].user, conv[i].ts) );
          }
        }
      }
      setLastSlackMessageTS(conv[i].ts);
    }
  } catch (exception) {
    updateLogSheet("scheduledPollingCommandsFromSlack()　問題発生！！！中止します");
    throw new Error(exception);
  } finally {
    //シートにかかっていたプロテクションをすべて削除する。
    // TODO:他のプロテクションも全部削除してしまう問題を修正する
    removeProtection(); 
  }
  
  if( ret.length > 0 ){
    let msg_body = ret.join("\n");
    let msg = {type: "section",
             text: {
               type: "mrkdwn",
               text: "<"+DOCUMENT_URL+"|要回答など期限管理>\n"
               + "タスク了解/完了コマンドの処理が完了しました。<成功>は管理簿の更新が成功\n"
               + "できたもの。 <無効>はコマンド処理が無視されたものです。\n"
               + msg_body
             }};
    updateLogSheet("Slack送信["+ JSON.stringify(msg)+"]");

    slackSendMessageToTeam(JSON.stringify([msg]));
  }
  console.log("処理後の最終メッセージID["+getLastSlackMessageTS()+"]");
  updateLogSheet("scheduledPollingCommandsFromSlack()　完了しました。コマンド抽出件数["+ret.length+"]件 最後のメッセージID["+getLastSlackMessageTS()+"]");
}





function taskack(text, user, message_ts){
  console.log("taskack() start: user["+user+"] text["+text+"] message_ts["+message_ts+"]"); 
  let linkToMsg = slackLinkToTeamMessage(message_ts);
  let taskID,action;
  let regexpCommand = /^[\u{20}\u{3000}]*([tT]\d\d\d\d?)[\x20\u3000]+(.*)[\x20\u3000]*$/.exec(text);
  if ( regexpCommand != null ) { taskID = regexpCommand[1]; action = regexpCommand[2]; } 
  let rowNumber = findRowByTaskID(taskID);
  if ( rowNumber == null ) { 
    insertUserActionLogSheet("登録名未確認("+user+")", "taskack", taskID, "例外：タスクIDが見つかりません");
    return Utilities.formatString("<@%s>[%s]への[<%s|了解>]は *無効* :タスク管理簿にタスクIDが見つかりません",user,taskID,linkToMsg)
  };
  
  let range = getARowRangeForUpdate(rowNumber);
  let col   = columnNameMapForRange();

  //現状担当者の抽出
  let taskownerBefore = range.getCell(1,col("KKSE・KKZEの対応者")).getValue().toString(); 
  let userName = getUserOfficeNameBySlackUserID(user);
  //タスク担当者が未登録の場合、コマンドは無視する
  if ( userName == null ){
    insertUserActionLogSheet("未登録メンバー("+user+")", "taskack", taskID, "例外：メンバー登録されていません");
    return Utilities.formatString("<@%s>[%s]への[<%s|了解>]は *無効* :未登録ユーザからのコマンド",user,taskID,linkToMsg)
  }
  //コマンド実行者がすでにタスクに担当者として登録されていれば、コマンドは無視する
  if ( new RegExp(userName).test(taskownerBefore) ){
    insertUserActionLogSheet(userName+"("+user+")", "taskack", taskID, "例外：タスク担当者として登録済み");
    return Utilities.formatString("<@%s>[%s]への[<%s|了解>]は *無効* :[%s]さんは既に担当者として登録済み",user,taskID,linkToMsg, userName)
  }
  
  //タスク管理簿の更新
  let taskowner = taskownerBefore + (taskownerBefore ? ", " : "") + userName;
  range.getCell(1,col("KKSE・KKZEの対応者")).setValue(taskowner);
  
  //全員了解したら、PMOへステータスを"対応中"にするように促す
  let dataRow   = range.getValues();
  let assignedOwners = getKKSSAssignedTaskOwners(dataRow[0]);
  let nominatedOwners = getKKSSNominatedTaskOwners(dataRow[0]);
  let readyToGo = isReadyToWork(assignedOwners,nominatedOwners);
  
  let logMessage = Utilities.formatString("成功：タスク了解 担当者欄[%s] 担当者欄[%s] 依頼先担当[%s] 了解済担当[%s]"
            ,range.getA1Notation(),taskowner,nominatedOwners.join(","),assignedOwners.join(","));
  insertUserActionLogSheet(userName+"("+user+")", "taskack", taskID,logMessage );
  console.log("taskack() finished: user["+user+"] text["+text+"]" + logMessage );
     
  let ret =  Utilities.formatString("<@%s>[%s]への[<%s|了解>]は *成功* :担当者に%sさんを追加しました"
                                ,user,taskID,linkToMsg,userName);
  if (readyToGo) {
    return ret + "\n  --->[" +taskID+ "]全員了解です";
  } else {
    return ret + "\n  --->[" +taskID+ "] 依頼先担当[" + nominatedOwners.join(",")+ "] 了解済担当[" +assignedOwners.join(",")+ "]";
  }

}


function getKKSSAssignedTaskOwners(dataRow){
  let col  = columnNameMapForArrayIndex();
  let cell = [dataRow[col("KKSE・KKZEの対応者")]
                ].join(",");
  if(! cell ){return []}
  let members = getDefinitionFromCache(DEF_MEMBER);
  let ret = Object.keys(members).filter( t => cell.indexOf(t) != -1 ); 
  return ret;
}

function getKKSSNominatedTaskOwners(dataRow){
  let col  = columnNameMapForArrayIndex();
  let cell = [dataRow[col("Box-PMO")]
              ,dataRow[col("KKSS-社員")]
              ,dataRow[col("KKSS-協力会社請負")]
              ,dataRow[col("KKSS-協力会社準委任")]
              ].join(",");
  if(! cell ){return []}
  let members = getDefinitionFromCache(DEF_MEMBER);
  let ret = Object.keys(members).filter( t => cell.indexOf(t) != -1 ); 
  return ret;
}


function isReadyToWork(assignedOwners,nominatedOwners){
  //null、空文字、数値のzero, 真偽値のfalseはここで処理する
  if( ! Array.isArray(assignedOwners) || ! Array.isArray(nominatedOwners) ){return false} 
  if ( assignedOwners.length == 0 && nominatedOwners.length == 0){return false}
  if( nominatedOwners.length == 0 ){return true}
  if( assignedOwners.length == 0 ){return false}
  let ret = nominatedOwners.every( e => assignedOwners.includes(e) );
  return ret;
}



function taskcomplete(text, user, message_ts){
  console.log("taskcomplete() start: user["+user+"] text["+text+"] message_ts["+message_ts+"]"); 
  let linkToMsg = slackLinkToTeamMessage(message_ts);
  let taskID,action;
  let regexpCommand = /^[\u{20}\u{3000}]*([tT]\d\d\d\d?)[\x20\u3000]+(.*)[\x20\u3000]*$/.exec(text);
  if ( regexpCommand != null ) { taskID = regexpCommand[1]; action = regexpCommand[2]; } 
  let rowNumber = findRowByTaskID(taskID);
  if ( rowNumber == null ) { 
    insertUserActionLogSheet("登録名未確認("+user+")", "taskcomplete", taskID, "例外：タスクIDが見つかりません");
    return Utilities.formatString("<@%s>[%s]への[<%s|完了>]は *無効* :タスク管理簿にタスクIDが見つかりません",user,taskID,linkToMsg)
  };
  
  let range = getARowRangeForUpdate(rowNumber);
  let col   = columnNameMapForRange();

  //現状のメモを取得
  let memoBefore = range.getCell(1,col("メモ")).getValue().toString(); 
  let userName = getUserOfficeNameBySlackUserID(user);
  //タスク担当者が未登録の場合、コマンドは無視する
  if ( userName == null ){
    insertUserActionLogSheet("未登録メンバー("+user+")", "taskcomplete", taskID, "例外：メンバー登録されていません");
    return Utilities.formatString("<@%s>[%s]への[<%s|完了>]は *無効* :未登録ユーザからのコマンド",user,taskID,linkToMsg)
  }
  //コマンド実行者がすでにタスク完了者として登録されていれば、コマンドは無視する
  //TODO: 読みにくいコードを見直す
  if ( memoBefore.split(/\n/).some( e=> new RegExp(userName+".*" + "完了").test(e) ) ){
    insertUserActionLogSheet(userName+"("+user+")", "taskcomplete", taskID, "例外：完了報告済み");
    return Utilities.formatString("<@%s>[%s]への[<%s|完了>]は *無効* :[%s]さんは既に完了報告済み",user,taskID,linkToMsg, userName)
  }
  
  //タスク管理簿の更新
  let memo = userName + ">完了 by Bot\n" + memoBefore;
  range.getCell(1,col("メモ")).setValue(memo);
  
 
  //全員完了したら、PMOへステータスを"完了"にするように促す
  //全員了解したら、PMOへステータスを"対応中"にするように促す
  let dataRow   = range.getValues();
  let completedOwners = getCompletedTaskOwners(dataRow[0]);
  let assignedOwners = getActualTaskOwners(dataRow[0]);
  let closeable = isCloseable(completedOwners,assignedOwners);
  
  let logMessage = Utilities.formatString("成功：タスク完了 メモ欄[%s]  メモ[%s] 担当[%s] 完了済[%s]"
            ,range.getA1Notation(),memo,assignedOwners.join(","),completedOwners.join(","));
  insertUserActionLogSheet(userName+"("+user+")", "taskcomplete", taskID,logMessage );
  console.log("taskcomplete() finished: user["+user+"] text["+text+"]" + logMessage );
  let ret =  Utilities.formatString("<@%s>[%s]への[<%s|完了>]は *成功* :メモ欄に%sさんの完了報告を追加しました。"
                                ,user,taskID,linkToMsg,userName);  
  if ( closeable ){
    return ret + "\n  --->[" +taskID+ "] 全員完了です";
  } else {
    return ret + "\n  --->[" +taskID+ "] 担当[" + assignedOwners.join(",")+ "] 完了済[" +completedOwners.join(",")+ "]";
  }
}


function getCompletedTaskOwners(dataRow){
  let col  = columnNameMapForArrayIndex();
  let cell = [dataRow[col("メモ")]
                ].join(",");
  let members = getDefinitionFromCache(DEF_MEMBER);
  let ret = Object.keys(members).filter( t => new RegExp(t+".*完了").test(cell) );
  return ret;
}

function getActualTaskOwners(dataRow){
  let col  = columnNameMapForArrayIndex();
  let cell = [dataRow[col("KKSE・KKZEの対応者")]
                ,dataRow[col("KGAM-社員")]
                ,dataRow[col("KGAM-協力会社請負")]
                ,dataRow[col("KGAM-協力会社準委任")]
                ,dataRow[col("KGRM-社員")]
                ,dataRow[col("KGRM-協力会社請負")]
                ,dataRow[col("KGRM-協力会社準委任")]
                ].join(",");
  let members = getDefinitionFromCache(DEF_MEMBER);
  let ret = Object.keys(members).filter( t => cell.indexOf(t) != -1 ); 
  return ret;
}



function isCloseable(completedOwners,assignedOwners){
  //null、空文字、数値のzero, 真偽値のfalseはここで処理する
  if( ! Array.isArray(completedOwners) || ! Array.isArray(assignedOwners) ){return false} 
  if ( completedOwners.length == 0 && assignedOwners.length == 0){return false}
  if( assignedOwners.length == 0 ){return true}
  if( completedOwners.length == 0 ){return false}

  //すべての(every)のassignedOwnerの要素が、completedOwnerのいずれか１つ以上の要素(some)と条件があうかどうか？
  let ret = assignedOwners.every( e => completedOwners.includes(e) );
  return ret;
}

function doGet(e) {
  let data = listTask();
  let html = JSON.stringify(data,jsonStringifyReplacer);
  html  = "<pre>" + html + "</pre>";
  return HtmlService.createHtmlOutput(html);
  
}








