
/***********************************************************************************
        　共通機能 業務機能系
************************************************************************************/

/**
 * 直近期日のタスクを抽出する　（毎朝のレポート用）
 */
function listTask() {
  let taskSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TASK);
  let data = [], pendRowNo = [], dataRanges;
  let col = columnNameMapForA1Notation();
  //対応中、着手指示待ちの行番号を抽出する
  let lastRow = taskSheet.getLastRow().toString();
  let finder = taskSheet
    .getRange(col("ステータス") + "1:" + col("ステータス") + lastRow)
    .createTextFinder("(対応中|着手指示待ち)")
    .useRegularExpression(true);
  //抽出した行番号に対応した行のデータを抽出する。
  let stop = stopWatch();
  finder.findAll().forEach(e => pendRowNo.push("A" + e.getRow() + ":" + convertToLetter(taskSheet.getLastColumn()) + e.getRow()));
  if (pendRowNo.length == 0) { return { dueToday: {}, dueNextBusDay: {}, pendAssign: {} } }
  console.log("findAll in listTask() completed in " + stop() + "sec");
  stop = stopWatch();
  dataRanges = taskSheet.getRangeList(pendRowNo).getRanges();
  dataRanges.forEach(e => data.push(e.getValues()[0]));
  console.log("getRangeList in listTask() completed in " + stop() + "sec");

  let thisFriday = toDateString(getComingFriday(new Date(), 0));
  let nextFriday = toDateString(getComingFriday(new Date(), 1));
  let nextNextFriday = toDateString(getComingFriday(new Date(), 2));
  col = columnNameMapForArrayIndex();
  let dueToday = [], dueNextBusDay = [], pendAssign = [], weekly = [0, 0, 0, 0];
  for (let i = 0; i < data.length; i++) {
    let taskID = data[i][col("タスクID")];
    let dueDate = data[i][col("期日")];
    let dueDateStr = toDateString(dueDate);
    if (!(dueDate instanceof Date) && (data[i][col("正式期限")] instanceof Date)) {
      dueDate = data[i][col("正式期限")];
      //TODO: 一度の呼出しで3秒程度かかるので、性能対策する
      updateLogSheet("データエラー：期日が未設定、もしくはDate型ではないですが正式期限は妥当な値です at listTask() taskID[" + taskID + "] dueDate[" + dueDate + "]");
    }
    if (!(dueDate instanceof Date)) {
      //TODO: 一度の呼出しで3秒程度かかるので、性能対策する
      updateLogSheet("データエラー：期日(および正式期限)が未設定、もしくはDate型ではない at listTask() taskID[" + taskID + "] dueDate[" + dueDate + "]");
      continue;
    }
    let busDaysToDueDate = diffWorkingDays(new Date(), dueDate);
    let status = data[i][col("ステータス")];
    console.log("listTask() processing taskID:" + taskID + " 期日:" + dueDateStr + " ステータス:" + status);

    if (status == "着手指示待ち") {
      pendAssign.push(data[i]);
    } else if (busDaysToDueDate <= 0) {    //YYYY/MM/DD形式で統一しているので、辞書順の大小比較で日付の前後を判定可能
      dueToday.push(data[i]);
    } else if (busDaysToDueDate == 1) {
      dueNextBusDay.push(data[i]);
    }


    if (dueDateStr <= thisFriday) {
      weekly[0]++;
    } else if (dueDateStr <= nextFriday) {
      weekly[1]++;
    } else if (dueDateStr <= nextNextFriday) {
      weekly[2]++;
    } else {
      weekly[3]++;
    }
  }

  return { dueToday: dueToday, dueNextBusDay: dueNextBusDay, pendAssign: pendAssign, weekly: weekly };
}


/**
 * Remineのチケット番号を、ハイパーリンクに変換する
 * @param {any} text Redmine番号を表す文字または数値
 */
function redmineToLink(text) {
  if (!text) {
    return "#______";
  } else if (/^\#\d{5,6}$/.test(text)) {
    //URLを組み立てるために番号部分以外は削除
    text = text.replace(/^\s*#|\s*$/, "");
    //ただし、表示名称は読みやすくするために#をつけなおす
    return `<http://${REDMINE_HOST}/redmine/issues/${text}|#${text}>`;
  } else if (/^\d{5,6}$/.test(text)) {
    //#が先頭にない場合、そのままリンクを作成
    return `<http://${REDMINE_HOST}/redmine/issues/${text}|#${text}>`;
  } else {
    //numberのまま返却すると、後続の以下のような処理でInvalid array lengthエラーになってしまう。
    //TODO:正しい対処方法を確認する
    // text = text + Utilities.formatString("  %5s %5s %7s %s\n",taskID,dueDateStr,redmine,title);
    return "#______";   //text.toString();
  }
}

/**
 * 
 * https://javascript.programmer-reference.com/javascript-han1zen2/
 */
function truncateIn60Chars(str) {
  str = str.toString().replace(/\[.*?\]/, "").replace(/\(回答中\)/, "").split(/\n/)[0];
  let result = 0;
  for (let i = 0; i < str.length; i++) {
    let chr = str.charCodeAt(i);
    if ((chr >= 0x00 && chr < 0x81) ||
      (chr === 0xf8f0) ||
      (chr >= 0xff61 && chr < 0xffa0) ||
      (chr >= 0xf8f1 && chr < 0xf8f4)) {
      //半角文字の場合は1を加算
      result += 1;
    } else {
      //それ以外の文字の場合は2を加算
      result += 2;
    }
    if (result > 60) {
      return str.slice(1, i) + "...";
    }
  }
  //結果を返す
  return str;
};

/***********************************************************************************
        　共通機能 Slack系　
************************************************************************************/
function getSlackBotAppToken() {
  let columnDef = getDefinitionFromCache(DEF_APP_CONFIG);
  if (!columnDef["SLACK_APP_TOKEN"]) { throw new Error("問題発生：SLACK_APP_TOKENが定数シートに登録されていません") }
  return columnDef["SLACK_APP_TOKEN"][0];
}
function getSlackTeamChannelID() {
  let columnDef = getDefinitionFromCache(DEF_APP_CONFIG);
  if (!columnDef["SLACK_TEAM_CHANNEL"]) { throw new Error("問題発生：SLACK_TEAM_CHANNELが定数シートに登録されていません") }
  return columnDef["SLACK_TEAM_CHANNEL"][0];
}
function getSlackDeveloperID() {
  let columnDef = getDefinitionFromCache(DEF_APP_CONFIG);
  if (!columnDef["DEVELOPER_SLACK_ID"]) { throw new Error("問題発生：DEVELOPER_SLACK_IDが定数シートに登録されていません") }
  return columnDef["DEVELOPER_SLACK_ID"][0];
}

//メッセージ送信　- chat.postMessageの使用
// - 必要なスコープはBot Token Scopesの　chat:write
function slackSendMessageToChannel(channelID, message) {

  let messagePayload = {
    "token": getSlackBotAppToken(),  //開発時(Incoming Webhooks)はこちらをコメントアウト
    "channel": channelID,
    "blocks": message,
    "text": "処理が完了しました"
  };
  let messageOptions = {
    "method": "post",
    "contentType": "application/x-www-form-urlencoded",
    //"contentType": "application/json",  <-- 通常はこちらだが、上記でずっと試していたので。。
    "payload": messagePayload
  };
  let httpRes = UrlFetchApp.fetch("https://slack.com/api/chat.postMessage", messageOptions);
  let ret = JSON.parse(httpRes);
  if (ret.ok == false) {
    throw new Error("問題発生：Slack メッセージ送信に失敗。チャンネルID[" + channelID + "]" + JSON.stringify(ret));
  } else {
    return;
  }
}

function slackSendMessageToTeam(message) {
  if (getReleaseEnvironment() == "PROD") {
    slackSendMessageToChannel(getSlackTeamChannelID(), message);
  } else if (getReleaseEnvironment() == "DEV") {
    let channelID = slackConversationOpenByUserID(getSlackDeveloperID());
    slackSendMessageToChannel(channelID, message);
  }
}

//メッセージ送信　- Incoming-Webhooksの使用
// - Slack APP HOme → Features → Incoming-Webhooksを選択し、Webhook URLからURLをコピーして、第一引数に張り付ける。
// - 必要なスコープはBot Token Scopesの　chat:write
function slackSendMessageToWebhooks(message) {
  let messagePayload = {//incoming webhooks はtokenやチャネルは不要
    "blocks": message,
  };
  let messageOptions = {
    "method": "post",
    "contentType": "application/x-www-form-urlencoded",
    //"contentType": "application/json",  <-- 通常はこちらだが、上記でずっと試していたので。。
    "payload": JSON.stringify(messagePayload)   //Incoming Webhooksはstringifyする
  };
  let httpRes = UrlFetchApp.fetch(getSlackIncomingWebhooksURL(), messageOptions);
  let ret = JSON.parse(httpRes);
  if (ret.ok == false) {
    throw new Error("問題発生：Slack メッセージ送信に失敗。チャンネルID[" + channelID + "]" + JSON.stringify(ret));
  } else {
    return;
  }
}

function getSlackIncomingWebhooksURL() {
  let columnDef = getDefinitionFromCache(DEF_APP_CONFIG);
  if (!columnDef["IN_WEBHOOKS_URL"]) { throw new Error("問題発生：SLACK_APP_TOKENが定数シートに登録されていません") }
  return columnDef["IN_WEBHOOKS_URL"][0];
}


//メッセージの読み取り -  conversations.historyの使用
// - 必要なスコープはBot Token Scopesの　channels:read,im:read (groups:read or mpim:read)
// ()内はこのSlack Appでは利用しない
function slackReadMessages(channelID) {

  let messagePayload = {
    "token": getSlackBotAppToken(),
    "channel": channelID,
    "limit": 30,
  };
  let last_ts = getLastSlackMessageTS();
  if (last_ts == null) {
    messagePayload["limit"] = 1;
  } else if (/^\d+\.\d+$/.test(last_ts)) {
    messagePayload["oldest"] = last_ts;
  } else {
    throw new Error("問題発生:プロパティに設定されている最後のメッセージTSが不正です[" + last_ts + "]");
  }
  let messageOptions = {
    "method": "get",
    "contentType": "application/x-www-form-urlencoded",
    "payload": messagePayload
  };
  console.log("slack read :" + JSON.stringify(messageOptions));
  let httpRes = UrlFetchApp.fetch("https://slack.com/api/conversations.history", messageOptions)
  let ret = JSON.parse(httpRes);
  if (ret.ok == false) {
    throw new Error("問題発生：Slack メッセージ受信に失敗。チャンネルID[" + channelID + "]" + JSON.stringify(ret));
  } else {
    let data = [];
    ret.messages.forEach(e => data.push({ text: e.text, user: e.user, ts: e.ts }));
    return data;
  }
}

function getLastSlackMessageTS() {
  //スクリプトプロパティの値を取得
  let env = getReleaseEnvironment();
  let prop = PropertiesService.getScriptProperties();
  let res = prop.getProperty("LAST_SLACK_MESSAGE_TS_" + env);
  return res;
}

function setLastSlackMessageTS(last_message_ts) {
  //スクリプトプロパティの値を取得
  let env = getReleaseEnvironment();
  let prop = PropertiesService.getScriptProperties();
  prop.setProperty("LAST_SLACK_MESSAGE_TS_" + env, last_message_ts);
}

function slackReadMessagesFromTeamChannel() {
  if (getReleaseEnvironment() == "PROD") {
    return slackReadMessages(getSlackTeamChannelID());
  } else if (getReleaseEnvironment() == "DEV") {
    let channelID = slackConversationOpenByUserID(getSlackDeveloperID());
    return slackReadMessages(channelID);
  }
}

// 別メッセージへのリンク作成 - chat.getPermalinkの使用
// - 必要なスコープはBot Token Scopesの　channels:read,im:read ( groups:read,  or mpim:read )
// ()内はこのSlack Appでは利用しない
function slackLinkToMessage(channelID, message_ts) {
  let messagePayload = {
    "token": getSlackBotAppToken(),
    "channel": channelID,
    "message_ts": message_ts,
  };
  let messageOptions = {
    "method": "get",
    "contentType": "application/x-www-form-urlencoded",
    "payload": messagePayload
  };
  let httpRes = UrlFetchApp.fetch("https://slack.com/api/chat.getPermalink", messageOptions);
  let ret = JSON.parse(httpRes);
  if (ret.ok == false) {
    throw new Error("問題発生：Slack メッセージ参照に失敗。チャンネルID[" + channelID + "]" + JSON.stringify(ret));
  } else {
    return ret.permalink;
  }
}

function slackLinkToTeamMessage(message_ts) {
  if (getReleaseEnvironment() == "PROD") {
    return slackLinkToMessage(getSlackTeamChannelID(), message_ts);
  } else if (getReleaseEnvironment() == "DEV") {
    let channelID = slackConversationOpenByUserID(getSlackDeveloperID());
    return slackLinkToMessage(channelID, message_ts);
  }
}

//userIDからチャンネルIDを特定し、会話を開局する
//userIDに対して１対１のメッセージを送信することを"DM"と呼ぶ。
//DMを送れるのは、通常のユーザだけで、Botに対してメッセージ送信するとエラーになる
//ただし、実験したところ、会話の開局をしなくても、エラーにならなかったので、会話の開局は不要かもしれない
// im.openは非推奨となっており、conversation.open APIを利用する必要がある。
// - 必要なスコープはBot Token Scopesのim:write
function slackConversationOpenByUserID(userID) {
  // - ユーザ名ではなくユーザIDしか受け付けない
  // - https://api.slack.com/changelog/2017-09-the-one-about-usernames
  let imPayload = {
    "token": getSlackBotAppToken(),
    "users": userID,   //DM相手のSlackユーザーID（@とかはいらない）,
  };

  let imOptions = {
    "method": "post",
    "contentType": "application/x-www-form-urlencoded",
    "payload": imPayload
  };
  let httpRes = UrlFetchApp.fetch("https://slack.com/api/conversations.open", imOptions);
  let ret = JSON.parse(httpRes);
  if (ret.ok == false) {
    throw new Error("問題発生：Slack チャンネルの開局に失敗。ユーザID[" + userID + "]");
  } else {
    return ret.channel.id;
  }
}




/***********************************************************************************
        　共通機能 アプリ設定・定数系
************************************************************************************/
function getDefinitionFromCache(category) {
  const cacheService = CacheService.getScriptCache();
  let cache = cacheService.get(category);
  if (cache == null) {
    //定数シート全体を一度だけ読み込む
    let defSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_DEF);
    let dataValues = defSheet.getDataRange().getValues();

    for (let i = 0; i < DEF_ITEM_LIST.length; i++) {
      cache = {};
      if (DEF_ITEM_LIST[i] == DEF_HOLIDAYS) {
        let data2d = SpreadsheetApp.getActiveSpreadsheet().getRangeByName('祝日').getValues();
        let holidays = flat2Dto1D(data2d);  //flat化。2次元配列を１次元配列へ
        holidays.forEach(e => cache[toDateString(e)] = true);
      } else {
        for (let j = 0; j < dataValues.length; j++) {
          if (dataValues[j][0] == DEF_ITEM_LIST[i]) {
            cache[dataValues[j][1].toString()] = [dataValues[j][2], dataValues[j][3], dataValues[j][4]];
          }
        }
      }
      cacheService.put(DEF_ITEM_LIST[i], JSON.stringify(cache), 21600); //約6時間キャッシュする
    }
  }
  return JSON.parse(cacheService.get(category));

}


function getReleaseEnvironment() {
  let columnDef = getDefinitionFromCache(DEF_APP_CONFIG);
  let env = columnDef["ENV_DEV_OR_PROD"][0];
  if (!env) { throw new Error("問題発生：ENV_DEV_OR_PRODが定数シートに登録されていません") }
  if (env == "DEV" || env == "PROD") {
    return env;
  } else {
    throw new Error("問題発生：ENV_DEV_OR_PRODが定数シートに登録されていません");
  }
}


function getUserOfficeNameBySlackUserID(slackUserID) {
  let columnDefTask = getDefinitionFromCache(DEF_MEMBER);
  let ret = Object.keys(columnDefTask).filter(e => columnDefTask[e][1] == slackUserID);
  if (ret.length == 0) {
    return null;
  } else if (ret.length == 1) {
    return ret[0];
  } else {
    throw new Error("問題発生：SlackユーザID[" + slackUserID + "]に対して複数のユーザが定義されています");
  }
}


function getUserEmailAddresses() {
  let columnDefTask = getDefinitionFromCache(DEF_MEMBER);
  let emailAddresses = Object.keys(columnDefTask)
    .map(e => columnDefTask[e][0])
    .filter(e => /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/.test(e))
  return emailAddresses;
}

/***********************************************************************************
        　共通機能 グーグルスプレッドシート系
************************************************************************************/
/**
 * シートの列番号からアルファベットの列名を特定する
 */
function convertToLetter(columnNumber) {
  if (columnNumber < 1) { throw new Error("問題発生：パラメータcolumnNumberは1以上でなければいけません") }
  let alpha, remainder, ret = "";
  alpha = parseInt(columnNumber / 27);
  remainder = columnNumber - (alpha * 26);
  if (alpha > 0) {
    ret = String.fromCharCode(alpha + 64);
  }
  if (remainder > 0) {
    ret = ret + String.fromCharCode(remainder + 64)
  }
  return ret;
}

/**
 * タスク管理簿の列定義をA1記法で取得
 * Sheet.getRangeList()関数は引数にA1記法しか受け入れてくれない　例：["A1:A2","B10:B11"]
 * どうしてもA1記法が必要な場合に使う関数
 */
function columnNameMapForA1Notation() {
  let columnDefTask = getDefinitionFromCache(DEF_COLUMN_TASK);
  let ret = {};
  Object.keys(columnDefTask).forEach(e => ret[e] = convertToLetter(Number(columnDefTask[e][0]) + 1));
  return function (key) {
    if (ret[key] == null) { throw new Error("問題発生：未定義のキー[" + key + "]で定数データを取得しようとしました") }
    return ret[key];
  };
}

/**
 * タスク管理簿の列定義をRangeで利用できる形で取得
 * Sheet.getRange(row,col)などで取得する場合、列番号は１から始まる
 * そのため、＋１する必要がある
 */
function columnNameMapForRange() {
  let columnDefTask = getDefinitionFromCache(DEF_COLUMN_TASK);
  let ret = {};
  Object.keys(columnDefTask).forEach(e => ret[e] = Number(columnDefTask[e][0]) + 1);
  return function (key) {
    if (ret[key] == null) { throw new Error("問題発生：未定義のキー[" + key + "]で定数データを取得しようとしました") }
    return ret[key];
  };
}

/**
 * タスク管理簿の列定義をRangeで利用できる形で取得
 * Range.getValues()などで取得した２次元配列の場合、列番号は０から始まる
 */
function columnNameMapForArrayIndex() {
  let columnDefTask = getDefinitionFromCache(DEF_COLUMN_TASK);
  let ret = {};
  Object.keys(columnDefTask).forEach(e => ret[e] = Number(columnDefTask[e][0]));
  return function (key) {
    if (ret[key] == null) { throw new Error("問題発生：未定義のキー[" + key + "]で定数データを取得しようとしました") }
    return ret[key];
  };
}

/**
 * タスク管理簿上のタスクIDに該当する行番号を返却する
 */
function findRowByTaskID(taskID) {
  let data = [], pendRowNo = [], finder, dataRanges;
  let taskSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TASK);

  let col = columnNameMapForA1Notation();
  let lastRow = taskSheet.getLastRow().toString();
  //T900 を T0900へ整形
  let normalizedTaskID = taskID.replace(/^([tT])(\d\d\d)$/, "$10$2");

  finder = taskSheet.getRange(col("タスクID") + "1:" + col("タスクID") + lastRow)
    .createTextFinder(normalizedTaskID).useRegularExpression(true);
  //重複して同じタスクIDが存在したら最初のものを取得する。ただし、タスクIDは重複しない前提

  let ret = finder.findNext();
  if (ret != null) {
    return ret.getRow();
  } else {
    return null;
  }
}

/**
 * タスク管理簿の指定の行を、更新用に１行まるごとRange型で返却する
 * 関数の利用側がRange型にアクセスできるといろいろできてしまってバグや性能劣化になりやすいので、なるべくこの関数は利用しない
 */
function getARowRangeForUpdate(rowNumber) {
  let taskSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TASK);
  let ret = taskSheet.getRange(rowNumber, 1, 1, taskSheet.getLastColumn());
  if (ret == null) { throw new Error("問題発生：Rangeの取得に失敗しました") }
  return ret;
}

/**
 * タスク管理簿上でもっとも大きなタスクIDを特定する
 */
function findMaxTaskID() {
  let taskSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TASK);
  let col = columnNameMapForRange();
  let data = taskSheet.getRange(1, col("タスクID"), taskSheet.getLastRow(), 1).getValues();
  let taskIds = data.filter(e => /^[tT]\d\d\d\d$/.test(e));
  if (taskIds == null || taskIds.length == 0) {
    throw new Error("問題発生：MaxタスクIDの取得失敗");
  } else if (taskIds.length == 1) {
    return taskIds[0];
  } else {
    return taskIds.reduce((a, b) => a > b ? a : b);
  }
}

/**
 * システムログシートにログコメントを追記する
 */
function updateLogSheet(comment) {
  let logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SYSTEM_LOG);
  let maxRowIndex = logSheet.getDataRange().getLastRow();
  let col = 1;
  let row = maxRowIndex + 1;
  logSheet.getRange(row, col++).setValue(toTimestamp(new Date()));
  logSheet.getRange(row, col++).setValue(comment);
}

/**
 * ユーザログシートにログメッセージを追記する
 */
function insertUserActionLogSheet(user, action, taskID, message) {
  let logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERACTION_LOG);
  let maxRowIndex = logSheet.getDataRange().getLastRow();
  updateUserActionLogSheet(maxRowIndex + 1, user, action, taskID, message);
}

/**
 * ユーザログシートの特定の行(id)のログメッセージを更新する
 */
function updateUserActionLogSheet(id, user, action, taskID, message) {
  let logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERACTION_LOG);
  let col = 1;
  let row = id;
  let timeStamp = toTimestamp(new Date());
  let data = [[id, timeStamp, user, action, taskID, message]];

  logSheet.getRange(row, col, 1, 6).setValues(data);
}


/**
 * 管理簿をロックする
 * Range単位のプロテクションとSheet単位のプロテクションがあるが、Range単位のほうが処理が遅くなるので
 * Sheet単位のプロテクション方式とする。Range＝＞2.19秒 Sheet=> 1.35秒
 * 
 * プロテクションをかけると、同時に編集していたメンバーは、即時編集ができなくり、編集しようとすると、
 * 以下のエラーによって編集ができなくなる
 * 　　問題が発生しました
 * 　　保護されているセルやオブジェクトを編集しようとしています。編集する必要がある場合は、
 *   　スプレッドシートのオーナーに連絡して、保護を解除してもらってください。
 * 
 * もしも別ユーザがプロテクションをすでにかけていた場合、
 *    →範囲が異なっていても、重複する部分にプロテクションがかかる。
 *    →このスクリプトはオーナー権限による実行となるため、設定済みのプロテクションよりも強力
 *    　そのため、例え別ユーザがすでにプロテクションをかけていたとしてもこのスクリプトがプロテクションを
 *      追加すると、そのユーザは編集ができなくなる。 
*/
function protectTaskSheet() {
  console.log("protectRange() start"); let stop = stopWatch();
  //let protection = range.protect().setDescription('m(_ _)m タスク管理Botが編集中です');
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TASK);
  let protection = sheet.protect().setDescription('m(_ _)m タスク管理Botが編集中です');
  let me = Session.getEffectiveUser();
  protection.addEditor(me);
  let editors = protection.getEditors().map(e => e.getEmail());
  protection.removeEditors(editors);
  editors = protection.getEditors().map(e => e.getEmail());
  if (protection.canDomainEdit()) {
    protection.setDomainEdit(false);
  }
  console.log("protectRange() finished in " + stop() + "ms");
}

/**
 * 管理簿のロックを解除する
 */
function removeProtection() {
  console.log("removeProtection() start"); let stop = stopWatch();
  //let protections = SpreadsheetApp.getActiveSpreadsheet().getProtections(SpreadsheetApp.ProtectionType.RANGE);
  let protections = SpreadsheetApp.getActiveSpreadsheet().getProtections(SpreadsheetApp.ProtectionType.SHEET);
  //TODO: 以下の処理だと、このスクリプトが作成したプロテクション以外も削除してしまう。
  for (let i = 0; i < protections.length; i++) {
    let protection = protections[i];
    if (protection.canEdit()) {
      protection.remove();
    }
  }
  console.log("removeProtection() finished in " + stop() + "ms");
}




/***********************************************************************************
        　共通機能 日付系
************************************************************************************/

function toTimestamp(date) {
  if (!(date instanceof Date)) { throw new Error("問題発生：toTimestamp()のパラメータはDate型でなければいけません") }
  return Utilities.formatDate(date, "JST", "yyyy/MM/dd HH:mm:ss");
}

function toDateString(date) {
  if (date instanceof Date) {
    return Utilities.formatDate(date, "JST", "yyyy/MM/dd");
  } else {
    return "____/__/__";
  }
}

function toDateShortString(date) {
  if (date instanceof Date) {
    return Utilities.formatDate(date, "JST", "MM/dd");
  } else {
    return "__/__";
  }
}


/**
 * 今週末のDateを取得する
 * https://codereview.stackexchange.com/questions/33527/find-next-occurring-friday-or-any-dayofweek
 */
function getNextDayOfWeek(date, dayOfWeek) {
  if (!(date instanceof Date)) { throw new Error("問題発生：getNextDayOfWeek()のパラメータdateはDate型でなければいけません") }
  let resultDate = new Date(date.valueOf());
  resultDate.setDate(date.getDate() + (7 + dayOfWeek - date.getDay()) % 7);
  return resultDate;
}

/**
 * 週の金曜日の日付を取得する
 * @param {Date} date 基準となる日付
 * @param {number} weeks 基準となる日付から何週先の金曜日かを整数で指定。weeks=0は、今週の金曜日。weeks=1は、来週の金曜日
 */
function getComingFriday(date, weeks) {
  if (!(date instanceof Date)) { throw new Error("問題発生：getComingFriday()のパラメータdateはDate型でなければいけません") }
  let d = new Date(date.valueOf());
  d.setDate(d.getDate() + weeks * 7);
  return getNextDayOfWeek(d, 5);
}

/**
 * 土日・祝日の考慮なしのdateDiff
 */
function dateDiff(startDate, endDate) {
  if (!(startDate instanceof Date)) { throw new Error("問題発生：dateDiff()のパラメータstartDateはDate型でなければいけません") }
  if (!(endDate instanceof Date)) { throw new Error("問題発生：dateDiff()のパラメータendDateはDate型でなければいけません") }
  //Google Sheetで2020/12/14と入力すると、なぜか ”Thu Dec 24 2020 17:00:00 GMT+0900 (Japan Standard Time)”となり
  //new Date("2020/12/24")として取得した”Thu Dec 24 2020 00:00:00 GMT+0900 (Japan Standard Time) ”と差異がでてしまう。
  //そこで、同じ基準に事前にならしておく必要がある。
  let cleanStartDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  let cleanendDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  return Math.floor((cleanendDate.valueOf() - cleanStartDate.valueOf()) / (24 * 3600 * 1000));
}


/**
 * ２つの日付の営業日数を取得する
 * 前提：　祝日が設定されていること 　
 */
function diffWorkingDays(startDate, endDate) {
  if (!(startDate instanceof Date)) { throw new Error("問題発生：diffWorkingDays()のパラメータstartDateはDate型でなければいけません") }
  if (!(endDate instanceof Date)) { throw new Error("問題発生：diffWorkingDays()のパラメータendDateはDate型でなければいけません") }
  let currentDate = startDate;
  let numberOfDays = 0;  //startDate==endDateの場合、結果は0となる
  if (dateDiff(startDate, endDate) < 0) { //startDateがendDateを追い越してしまった場合
    while (dateDiff(currentDate, endDate) < 0) {
      currentDate.setDate(currentDate.getDate() - 1);
      while (!isBusinessDay(currentDate)) {
        currentDate.setDate(currentDate.getDate() - 1);
      }
      numberOfDays--;
    }
  } else {
    while (dateDiff(currentDate, endDate) > 0) {
      currentDate.setDate(currentDate.getDate() + 1);
      while (!isBusinessDay(currentDate)) {
        currentDate.setDate(currentDate.getDate() + 1);
      }
      numberOfDays++;
    }
  }
  return numberOfDays;
}

/**
 * 次の営業日を取得する dateAdd()のようなもの
 * @param {number} count　基準となる日付から何営業日後かを示す正の整数
 * @param {Date} startDate 基準となる日付
 */
function getNextWorkDays(count, startDate) {
  if (count < 0) { throw new Error("問題発生：getNextWorkDays()は加算のみ対応しています") }
  if (!(startDate instanceof Date)) { throw new Error("問題発生：getNextWorkDays()のパラメータstartDateはDate型でなければいけません") }
  let day = new Date(startDate.valueOf());
  for (let i = 0; i < count; i++) {
    day.setDate(day.getDate() + 1);
    while (!isBusinessDay(day)) {
      day.setDate(day.getDate() + 1);
    }
  }
  return day;
}

/**
 * 指定した日付が営業日（土日でも祝日でもない平日）かどうか判定する
 */
//TODO: この性能の一時措置をどうするか？getDefinitionFromCache(DEF_HOLIDAYS) はだいたい10msぐらい。diffWorkingDays()だと数十回呼び出すので、ちりつもでかなり性能影響がある。
let TMP_HOLIDAYS = null;
function isBusinessDay(date) {
  if (!(date instanceof Date)) { throw new Error("問題発生：getNextWorkDays()のパラメータstartDateはDate型でなければいけません") }
  //土日ならば休み
  if (date.getDay() == 0 || date.getDay() == 6) {
    return false;
  }

  //祝日ならば休み  
  let dateString = toDateString(date);
  if ( TMP_HOLIDAYS == null ){
    TMP_HOLIDAYS = getDefinitionFromCache(DEF_HOLIDAYS);
  }
  
  if (TMP_HOLIDAYS[dateString] == true) { return false }

  //インターネットではうまくいく記事があったが、社内ではアクセスできず機能しない
  //let holidayCal = CalendarApp.getCalendarById('ja.japanese#holiday@group.v.calendar.google.com');
  //
  //if(holidayCal.getEventsForDay(date).length > 0){
  //  return false;
  //}
  return true;
}


/***********************************************************************************
        　共通機能 データ変換、データチェック系　
************************************************************************************/

/**
 * 性能計測
 * 使い方：
 * 　　stopWatch()を呼び出すと計測開始
 * 　　stopWatch()が返却する無名関数を呼び出すと計測終了し、経過時間がわかる
 */
function stopWatch() {
  //開始時間を取得する
  let sttime = new Date();

  //終了時間用の変数
  let edtime = "";
  return function () {
    edtime = new Date();
    return (edtime - sttime) / 1000;
  }
}
/**
 * 2次元配列を１次元配列へFlat化する。正確には１次元削除
 * 例： [ [a,b,c], [d,e,f], [g,h,i] ] --> [a,b,c,d,e,f,g,h,i]
 */
function flat2Dto1D(array) {
  return array.reduce((acc, val) => acc.concat(val), []);
}

/**
 * 入れ子の要素が存在するかどうかチェックする
 * 入れ子の子孫を直接アクセスすると、途中の要素が無い場合、以下のエラーが発生してしまう。
 *   Cannot read property '〇〇' of undefined
 * そこで入れ子の子孫へアクセスする前に、１つ１つ要素の有無をチェックする必要がある
 * https://tonari-it.com/gas-spreadsheet-find/#toc5
 */
function hasNestedKey(obj, level, ...rest) {
  if (obj === undefined) return false
  if (rest.length == 0 && obj.hasOwnProperty(level)) return true
  return hasNestedKey(obj[level], ...rest)
}


/**
 * 文字列のJSONをオブジェクトに変換する際の加工用のコールバックルーチン
 * 　ー　日付文字列をDate型に変換
 * 例：　var data = JSON.parse(TEST_DATA_TASKLIST,reviver);
 */
function reviver(key, value) {
  return /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/.test(value) ? new Date(value) : value;
}

/**
 * オブジェクトからJSON文字列に変換する際の加工用のコールバックルーチン
 * 
 * 後で、文字列のJSONをオブジェクトに変換する際に問題となるバックスラッシュを
 * 事前に整形する処理をする
 * 
 * 例：　var data = JSON.parse(TEST_DATA_TASKLIST,reviver);
 */
function jsonStringifyReplacer(key, value) {
  if (typeof value === "string") {
    // 改行コードやフォルダ区切りのバックスラッシュをエスケープする
    return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n");
  } else {
    return value;
  }
}


function clearCache(){
    DEF_ITEM_LIST.forEach( e => CacheService.getScriptCache().remove(e)); 
}
