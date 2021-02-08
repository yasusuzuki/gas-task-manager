function ALLTEST(){
	GROUPTESTBusinessFunction();
	GROUPTESTBusinessCommon();
  GROUPTESTSlack();
  GROUPTESTGlobalSettings();
  GROUPTESTGoogleSpreadSheet();
  GROUPTESTDate();
  GROUPTESTDataMainpulation();
  GROUPTESTOther();

}
/***********************************************************************************
        　テスト　業務機能系
************************************************************************************/
function GROUPTESTBusinessFunction(){
  TESTsummaryReport();
  TESTscheduledPollingCommandsFromSlack();
  TESTtaskack();
  TESTgetKKSSAssignedTaskOwners();
  TESTgetKKSSNominatedTaskOwners();
  TESTisReadyToWork();
  TESTtaskcomplete();
  TESTgetCompletedTaskOwners();
  TESTgetActualTaskOwners();
  TESTisCloseable();
}

/**
 * JSON.stringify()する際に,第二引数にjsonStringifyReplacer()を指定して、改行コードを整形しておくこと
 */

const TEST_DATA_TASKLIST = 
`{"dueToday":[
      ["📩","T0837","メール","#123456","2020-12-03T08:00:00.000Z","2020-12-04T08:00:00.000Z","","佐藤,鈴木、田中","対応中","タスク１","PJT管理","依頼者太郎","2020-11-06T08:00:00.000Z","〇〇について、\\n①〇〇する\\n②△△する\\n③××する","","","T://aa/bb/cc.xls","2期","","","","","","佐藤、鈴木","田中","","全員","斉藤、池田","","全員","","","〇","〇","●",""],
      ["📩","T0838","メール","#123456","2020-12-03T08:00:00.000Z","2020-12-04T08:00:00.000Z","","佐藤,鈴木、田中","対応中","タスク１","PJT管理","依頼者太郎","2020-11-06T08:00:00.000Z","〇〇について、\\n①〇〇する\\n②△△する\\n③××する","","","T://aa/bb/cc.xls","2期","","","","","","佐藤、鈴木","田中","","全員","斉藤、池田","","全員","","","〇","〇","●",""]],
 "dueNextBusDay":[
      ["📩","T0839","メール","#123456","2020-12-03T08:00:00.000Z","2020-12-04T08:00:00.000Z","","佐藤,鈴木、田中","対応中","タスク１","PJT管理","依頼者太郎","2020-11-06T08:00:00.000Z","〇〇について、\\n①〇〇する\\n②△△する\\n③××する","","","T://aa/bb/cc.xls","2期","","","","","","佐藤、鈴木","田中","","全員","斉藤、池田","","全員","","","〇","〇","●",""]
      ],
 "pendAssign":[
      ["📩","T0840","メール","#123456","2020-12-03T08:00:00.000Z","2020-12-04T08:00:00.000Z","","佐藤,鈴木、田中","対応中","タスク１","PJT管理","依頼者太郎","2020-11-06T08:00:00.000Z","〇〇について、\\n①〇〇する\\n②△△する\\n③××する","","","T://aa/bb/cc.xls","2期","","","","","","佐藤、鈴木","田中","","全員","斉藤、池田","","全員","","","〇","〇","●",""]
        ],
          "weekly":[7,4,3,5] 
     }`;




function TESTsummaryReport(){
  console.log("** TESTsummaryReport()");
  // listTask()関数をモックに置き換える
  let origListTask = listTask;
  listTask = function(){
    return JSON.parse(TEST_DATA_TASKLIST,reviver); 
  };
  let origslackSendMessageToTeam = slackSendMessageToTeam;
  slackSendMessageToTeam = function(text){
    console.log(text);
  }
  summaryReport();

  listTask = origListTask;
  slackSendMessageToTeam = origslackSendMessageToTeam;
}


function TESTscheduledPollingCommandsFromSlack(){
  console.log("** TESTsummaryReport()");
  //TODO: Slackをスタブ化してテストを完成させる
}

function TESTtaskack(){
  console.log("** TESTtaskack()");
}

function TESTgetKKSSAssignedTaskOwners(){
  console.log("** TESTgetKKSSAssignedTaskOwners()");
}

function TESTgetKKSSNominatedTaskOwners(){
  console.log("** TESTgetKKSSNominatedTaskOwners()");
}

function TESTisReadyToWork(){
  console.log("** TESTisReadyToWork");
  //実質担当者、指名担当者
  if( ! isReadyToWork(["鈴木","佐藤","田中"], ["鈴木","佐藤"]) ){ throw new Error("test failed")}; //true 
  if(   isReadyToWork(["鈴木","佐藤","田中"], [""]) ){ throw new Error("test failed")}; //false 
  if( ! isReadyToWork(["鈴木","佐藤","田中"], []) ){ throw new Error("test failed")}; //true 
  if(   isReadyToWork(["鈴木","佐藤","田中"], ["",1]) ){ throw new Error("test failed")}; //false
  if( ! isReadyToWork(["鈴木","佐藤","田中"], ["田中","佐藤","鈴木"]) ){ throw new Error("test failed")}; //true 

  if(   isReadyToWork([""], ["鈴木","佐藤"]) ){ throw new Error("test failed")}; //false
  if(   isReadyToWork(null, ["鈴木","佐藤"]) ){ throw new Error("test failed")}; //false 
  if(   isReadyToWork([""], ["鈴木","佐藤"]) ){ throw new Error("test failed")}; //false
  if( ! isReadyToWork([""], [""]) ){ throw new Error("test failed")}; //true
  if(   isReadyToWork(["鈴木"],["鈴木","佐藤"]) ){ throw new Error("test failed")}; //false 
}

function TESTtaskcomplete(){
  console.log("** TESTtaskcomplete");
}

function TESTgetCompletedTaskOwners(){
  console.log("** TESTgetCompletedTaskOwners");
  var dataRow = Array(30);
  var col  = columnNameMapForArrayIndex();
  //いったんキャッシュ内をバックアップし、テスト用の設定をロードする
  var cacheService = CacheService.getScriptCache();
  var origMember = cacheService.get(DEF_MEMBER);
  var member = {"鈴木":[,,], "田中":[,,],"佐藤":[,,]};
  cacheService.put(DEF_MEMBER, JSON.stringify(member), 21600); 

  var ret;
  dataRow[col("メモ")] = "鈴木";
  ret = getCompletedTaskOwners(dataRow);
  if( ret.toString() != [].toString() ){throw new Error("test failed")}

  dataRow[col("メモ")] = "鈴木\n田中完了";
  ret = getCompletedTaskOwners(dataRow);
  console.log("["+ret.toString()+"]");
  if( ret.toString() != ["田中"].toString() ){throw new Error("test failed")}

  dataRow[col("メモ")] = "鈴木\n田中、佐藤完了\n鈴木";
  ret = getCompletedTaskOwners(dataRow);
  if( ret.toString() != ["田中","佐藤"].toString() ){throw new Error("test failed")}

  dataRow[col("メモ")] = "鈴木\n田中、佐藤完了鈴木";
  ret = getCompletedTaskOwners(dataRow);
  if( ret.toString() != ["田中","佐藤"].toString() ){throw new Error("test failed")}
  
  //バックアップしたキャッシュ値をもとに戻す
  cacheService.put(DEF_MEMBER, origMember, 21600); 
}


function TESTgetActualTaskOwners(){
  console.log("** TESTgetActualTaskOwners");
}

function TESTisCloseable(){
  console.log("** TESTisCloseable");
  //完了報告欄、担当者欄
  var ret = isCloseable(["鈴木"],["鈴木、田中"]);
  if (   ret ) { throw new Error("test failed") } 
  ret = isCloseable(["鈴木","田中"],["鈴木","田中"]) 
  if ( ! ret ) { throw new Error("test failed") } 
  ret = isCloseable(["鈴木","田中","佐藤"],["鈴木","田中"])
  if ( ! ret ) { throw new Error("test failed") } 
  ret = isCloseable(null,["鈴木","田中"]);
  if (   ret ) { throw new Error("test failed") } 
  ret = isCloseable([],["鈴木","田中"]);
  if (   ret ) { throw new Error("test failed") } 
  ret = isCloseable([],[]);  
  if (   ret ) { throw new Error("test failed") } 
  ret = isCloseable(["鈴木"],[]);
  if ( ! ret ) { throw new Error("test failed") } 
}


/***********************************************************************************
        　テスト　共通機能 業務系　
************************************************************************************/
function GROUPTESTBusinessCommon(){
  TESTredmineToLink();
}
function TESTredmineToLink(){
  console.log("** TESTredmineToLink");
  var ret = redmineToLink(null);
  if(ret != `#______`) throw new Error("test failed");
  var ret = redmineToLink(12345);
  if(ret != `<http://${REDMINE_HOST}/redmine/issues/12345|#12345>`) throw new Error("test failed");
  var ret = redmineToLink(123456);
  if(ret != `<http://${REDMINE_HOST}/redmine/issues/123456|#123456>`) throw new Error("test failed");
  var ret = redmineToLink(123);
  if(ret != `#______`) throw new Error("test failed");
  var ret = redmineToLink(1234567);
  if(ret != `#______`) throw new Error("test failed");
  var ret = redmineToLink("#12345");
  if(ret != `<http://${REDMINE_HOST}/redmine/issues/12345|#12345>`) throw new Error("test failed");
  var ret = redmineToLink("#1234aaa");
  if(ret != `#______`) throw new Error("test failed");
  var ret = redmineToLink(new Date());
  if(ret != `#______`) throw new Error("test failed");
  var ret = redmineToLink("");
  if(ret != `#______`) throw new Error("test failed");

}

/***********************************************************************************
        　テスト　共通機能 Slack系　
************************************************************************************/
function GROUPTESTSlack(){
  TESTslackSendMessageToTeam();
}

function TESTslackSendMessageToTeam(){
  console.log("** TESTslackSendMessageToTeam");

  var debug_msg = [...Array(5)].map(x => x="成功：@Taro タスク[太郎]の担当者にT0837さんを追加しました").join("\n");
  var ret =[];
  ret.unshift({type: "section",
               text: {
                 type: "mrkdwn",
                 text: "<https://docs.google.com/spreadsheets/d/DUMMY_SHEET|要回答など期限管理>\nタスク引受と完了のコマンド処理が完了しました。<成功>は管理簿の更新が成功\nできたもの。 <無効>はコマンド処理が無視されたものです。"+debug_msg
               }});
  slackSendMessageToTeam(JSON.stringify(ret));
}

/***********************************************************************************
        　テスト　共通機能 アプリ設定・定数系
************************************************************************************/
function GROUPTESTGlobalSettings(){
  TESTgetDefinitionFromCache();
  TESTgetReleaseEnvironment();
  TESTgetUserOfficeNameBySlackUserID();
  TESTgetUserEmailAddresses();
}
function TESTgetDefinitionFromCache(){
  console.log("** TESTgetDefinitionFromCache");
  clearCache();
  DEF_ITEM_LIST.forEach(function(e){
    var ret = getDefinitionFromCache(e);
    console.log(e + ": "+JSON.stringify(ret));
  });
}

function TESTgetReleaseEnvironment(){
  console.log("** TESTgetReleaseEnvironment");
  //TODO:テストを実装する
}

function TESTgetUserOfficeNameBySlackUserID(){
  console.log("** TESTgetUserOfficeNameBySlackUserID");
  var ret = getUserOfficeNameBySlackUserID("aaa");
  if( ret != null) { throw new Error("test failed") }
  ret = getUserOfficeNameBySlackUserID("XXXXXXXXX");
  if( ret != "鈴木") { throw new Error("test failed") } 
}

function TESTgetUserEmailAddresses(){
  console.log("** TESTgetUserEmailAddresses");
  var cacheService = CacheService.getScriptCache();
  var member = {"鈴木":["test@gmail.com",,], "田中":["test2@gmail.com",,],"佐藤":["",,]};
  cacheService.put(DEF_MEMBER, JSON.stringify(member), 21600); 
  var ret;
  ret = getUserEmailAddresses();
  console.log(ret);
  cacheService.remove(DEF_MEMBER);
}


/***********************************************************************************
        テスト　共通機能 グーグルスプレッドシート系
************************************************************************************/
function GROUPTESTGoogleSpreadSheet(){
  TESTconvertToLetter();
  TESTcolumnNameMapForA1Notation();
  TESTcolumnNameMapForRange();
  TESTcolumnNameMapForArrayIndex();
  TESTcolumnNameMap();
  TESTfindRowByTaskID();
  TESTgetARowRangeForUpdate();
  TESTfindMaxTaskID();
  TESTupdateLogSheet();
  TESTinsertUserActionLogSheet();
  TESTupdateUserActionLogSheet();
  TESTprotectTaskSheet();
  TESTremoveProtection();
  TESTprotectRange();
}
function TESTconvertToLetter(){
  console.log("** TESTconvertToLetter");
  var ret;
  ret = convertToLetter(1); 
  if (ret != "A"){throw new Error("test failed")}
  ret = convertToLetter(26); 
  if (ret != "Z"){throw new Error("test failed")}
  ret = convertToLetter(27); 
  if (ret != "AA"){throw new Error("test failed")}
  ret = convertToLetter(52); 
  if (ret != "AZ"){throw new Error("test failed")}
}
function TESTcolumnNameMapForA1Notation(){
  //TODO:テストを実装する
}
function TESTcolumnNameMapForRange(){
  //TODO:テストを実装する
}
function TESTcolumnNameMapForArrayIndex(){
  //TODO:テストを実装する
}
function TESTcolumnNameMap(){
  console.log("** TESTcolumnNameMap");
  CacheService.getScriptCache().remove(DEF_COLUMN_TASK);
  var col = columnNameMapForA1Notation();
  console.log(col("タスクID"));
  //console.log(col("タスクXX"));  //throw error
  //console.log(col(null));  //throw error
  col = columnNameMapForRange();
  console.log(col("タスクID"));
  //console.log(col("タスクXX"));  //throw error
  //console.log(col(null));   //throw error
  col = columnNameMapForArrayIndex();
  console.log(col("タスクID"));
}

function TESTfindRowByTaskID(){
  console.log("** TESTfindRowByTaskID");

  if( 904 != findRowByTaskID("t0900")){throw new Error("test failed")}
  if( 904 != findRowByTaskID("t900")){throw new Error("test failed")}
  if( 904 != findRowByTaskID("T0900")){throw new Error("test failed")}
  if( 904 != findRowByTaskID("T900")){throw new Error("test failed")}
  if( null != findRowByTaskID("Txxx")){throw new Error("test failed")}
  if( null != findRowByTaskID("T9999")){throw new Error("test failed")}
}
function TESTgetARowRangeForUpdate(){
  //TODO:テストを実装する
}
function TESTfindMaxTaskID(){
  var stop = stopWatch();
  var ret = findMaxTaskID();
  console.log("Elapsed " + stop() + " ms " + ret );

}
function TESTupdateLogSheet(){
  //TODO:テストを実装する
}
function TESTinsertUserActionLogSheet(){
  //TODO:テストを実装する
}
function TESTupdateUserActionLogSheet(){
  //TODO:テストを実装する
}
function TESTprotectTaskSheet(){}
function TESTremoveProtection(){}
function TESTprotectRange(){
  protectTaskSheet();
  removeProtection();
}

/***********************************************************************************
        　テスト　共通機能 日付系
************************************************************************************/
function GROUPTESTDate(){
  TESTtoTimestamp();
  TESTtoDateString();
  TESTtoDateShortString();
  TESTgetNextDayOfWeek();
  TESTgetComingFriday();
  TESTdateDiff();
  TESTdiffWorkingDays();
  TESTgetNextWorkDays();
  TESTisBusinessDay();
}
function TESTtoTimestamp(){
  //TODO:テストを実装する
}
function TESTtoDateString(){
  //TODO:テストを実装する
}
function TESTtoDateShortString(){
  toDateShortString("2020/12/01");
}
function TESTgetNextDayOfWeek(){
  //TODO:テストを実装する
}
function TESTgetComingFriday(){
  var d = toDateString(getComingFriday(new Date("2020/12/14"),0)); //2020/12/18
  if ( d != "2020/12/18") { throw new Error("test failed") }
  var d = toDateString(getComingFriday(new Date("2020/12/15"),0)); //2020/12/18
  if ( d != "2020/12/18") { throw new Error("test failed") }
  var d = toDateString(getComingFriday(new Date("2020/12/18"),0)); //2020/12/18
  if ( d != "2020/12/18") { throw new Error("test failed") }
  var d = toDateString(getComingFriday(new Date("2020/12/19"),0)); //2020/12/25
  if ( d != "2020/12/25") { throw new Error("test failed") }
  var d = toDateString(getComingFriday(new Date("2020/12/20"),0)); //2020/12/25
  if ( d != "2020/12/25") { throw new Error("test failed") }
  var d = toDateString(getComingFriday(new Date("2020/12/21"),0)); //2020/12/25
  if ( d != "2020/12/25") { throw new Error("test failed") }

  var d = toDateString(getComingFriday(new Date("2020/12/14"),1)); //2020/12/25
  if ( d != "2020/12/25") { throw new Error("test failed") }
  var d = toDateString(getComingFriday(new Date("2020/12/15"),1)); //2020/12/25
  if ( d != "2020/12/25") { throw new Error("test failed") }
  var d = toDateString(getComingFriday(new Date("2020/12/18"),1)); //2020/12/25
  if ( d != "2020/12/25") { throw new Error("test failed") }
  var d = toDateString(getComingFriday(new Date("2020/12/19"),1)); //2021/1/1
  if ( d != "2021/01/01") { throw new Error("test failed") }
  var d = toDateString(getComingFriday(new Date("2020/12/20"),1)); //2021/1/1
  if ( d != "2021/01/01") { throw new Error("test failed") }
  var d = toDateString(getComingFriday(new Date("2020/12/21"),1)); //2021/1/1
  if ( d != "2021/01/01") { throw new Error("test failed") }
}

function TESTdateDiff(){
 console.log(new Date() + " " + new Date().valueOf() + " " + (  Math.floor((new Date().valueOf())/(24*3600*1000)) ) );
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TASK);
  console.log("dateDiff between E657 and E819 = " + dateDiff( sheet.getRange("E819").getValue(),sheet.getRange("E657").getValue()));
  
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TASK);
  console.log("dateDiff between today and E819 = " + dateDiff( new Date(),sheet.getRange("E657").getValue()));
  var date = sheet.getRange("E657").getValue();
  //Tue Dec 29 2020 17:00:00 GMT+0900 (Japan Standard Time)
  console.log("" + date + " " + date.valueOf() + " " + (  Math.floor((date.valueOf())/(24*3600*1000)) ) );
  
  date = sheet.getRange("E819").getValue();
  //Thu Dec 24 2020 17:00:00 GMT+0900 (Japan Standard Time)
  console.log("" + date + " " + date.valueOf() + " " + (  Math.floor((date.valueOf())/(24*3600*1000)) ) );
  
  date = sheet.getRange("E819").getValue();
  date = new Date( date.getFullYear(), date.getMonth(), date.getDate() );
  //Thu Dec 24 2020 17:00:00 GMT+0900 (Japan Standard Time) 
  console.log("" + date + " " + date.valueOf() + " " + (  Math.floor((date.valueOf())/(24*3600*1000)) ) );
  
  
  date = new Date("2020/12/16");
  //Wed Dec 16 2020 00:00:00 GMT+0900 (Japan Standard Time)
  console.log("" + date + " " + date.valueOf() + " " + (  Math.floor((date.valueOf())/(24*3600*1000)) ) );
  
  date = new Date("2020/12/16 17:00:00");
  //Wed Dec 16 2020 17:00:00 GMT+0900 (Japan Standard Time)
  console.log("" + date + " " + date.valueOf() + " " + (  Math.floor((date.valueOf())/(24*3600*1000)) ) );
  
}
function TESTdiffWorkingDays(){
  //2020年5月のGWは、 5/1(金)　5/2(土) 5/3(日) 5/4(祝) 5/5(祝) 5/6(振替休日) 5/7(木)
  var ret =diffWorkingDays( new Date("2020/5/1"),new Date("2020/5/7"));
  if ( ret != 1 ) { throw new Error("test failed") }
  ret =diffWorkingDays( new Date("2020/5/1"),new Date("2020/5/8"));
  if ( ret != 2 ) { throw new Error("test failed") }
  ret =diffWorkingDays( new Date("2020/5/7"),new Date("2020/5/1"));
  if ( ret != -1 ) { throw new Error("test failed") }
  ret =diffWorkingDays( new Date("2020/5/8"),new Date("2020/5/1"));
  if ( ret != -2 ) { throw new Error("test failed") }  
  ret =diffWorkingDays( new Date("2020/5/7"),new Date("2020/5/7"));
  if ( ret != 0 ) { throw new Error("test failed") }
  
}
function TESTgetNextWorkDays(){
  var stop = stopWatch();
  var offset = 2;
  var day = getNextWorkDays(1, new Date("2020/5/1"));
  var dayString = Utilities.formatDate(day, "Asia/Tokyo", "yyyy/MM/dd");
  if ( "2020/05/07" != Utilities.formatDate(day, "Asia/Tokyo", "yyyy/MM/dd") ){
    throw new Error("test failed");
  }
  day = getNextWorkDays(2, new Date("2020/5/1"));
  if ( "2020/05/08" != Utilities.formatDate(day, "Asia/Tokyo", "yyyy/MM/dd") ){
    throw new Error("test failed");
  }
  day = getNextWorkDays(1, new Date("2020/5/2"));
  if ( "2020/05/07" != Utilities.formatDate(day, "Asia/Tokyo", "yyyy/MM/dd") ){
    throw new Error("test failed");
  }
  day = getNextWorkDays(2, new Date("2020/5/2"));
  if ( "2020/05/08" != Utilities.formatDate(day, "Asia/Tokyo", "yyyy/MM/dd") ){
    throw new Error("test failed");
  }
  console.log("testgetNextWorkDays() took " + stop() + "ms");
}

function TESTisBusinessDay(){
  var ret = isBusinessDay(new Date("2020/5/2")); //土曜日
  if ( ret == true ) { throw new Error("test failed") }
  ret = isBusinessDay(new Date("2020/5/3"));  //日曜日　兼　憲法記念日
  if ( ret == true ) { throw new Error("test failed") }
  ret = isBusinessDay(new Date("2020/5/4")); //みどりの日
  if ( ret == true ) { throw new Error("test failed") }
  ret = isBusinessDay(new Date("2020/5/5")); //子供の日
  if ( ret == true ) { throw new Error("test failed") }
  ret = isBusinessDay(new Date("2020/5/6")); //憲法記念日の振り替え休日
  if ( ret == true ) { throw new Error("test failed") }
  ret = isBusinessDay(new Date("2020/5/7"));  //平日
  if ( ret == false ) { throw new Error("test failed") }
  ret = isBusinessDay(new Date("2020/5/8"));  //平日
  if ( ret == false ) { throw new Error("test failed") }
}

/***********************************************************************************
        　テスト　共通機能 データ変換、データチェック系　　
************************************************************************************/
function GROUPTESTDataMainpulation(){
  TESTstopWatch();
  TESTflat2Dto1D();
  TESThasNestedKey();
  TESTreviver();
  TESTjsonStringifyReplacer();
  TESTclearCache();  
}

function TESTstopWatch(){
  //TODO:テストを実装する
}
function TESTflat2Dto1D(){
  //TODO:テストを実装する
}
function TESThasNestedKey(){
  var data = REQ_TASKADD;
  if ( ! hasNestedKey(data,"parameter","token") ){
    throw new Error("test fail: #1");
  } else if ( hasNestedKey(data,"parameter","INVALID PARM") ){
    throw new Error("test fail: #2");
  } else if ( hasNestedKey(data,"parameter","token","INVALID_PARM") ){
    throw new Error("test fail: #3");
  } 
  
  data = REQ_PROCESS_RESPONSE;
  if ( ! hasNestedKey(data,"parameter","payload") ){
    throw new Error("test fail: #4");
  } else if ( ! hasNestedKey(JSON.parse(data.parameter.payload),"token") ){
    throw new Error("test fail: #5");
  } else if ( hasNestedKey(data,"parameter","payload","token") ){
    throw new Error("test fail: #6");
  }   

  console.log("SUCCESS: testhasNestedKey()");
}

function TESTreviver(){
  //TODO:テストを実装する
}
function TESTjsonStringifyReplacer(){
  //TODO:テストを実装する
}
function TESTclearCache(){
  //TODO:テストを実装する
}


/***********************************************************************************
        　テスト　その他　実験用　
************************************************************************************/
function GROUPTESTOther(){
  TESTNullCheck();
  TESTjapaneseCharacters();
  TESTformatString();
  TESTregexp();
}
function TESTNullCheck(){
  var hoge = {};
  console.log("if({}) -->" + (hoge?true:false) ); //true
  hoge = "abcd";
  console.log("if(\"abcd\") -->" + (hoge?true:false) ); //true
  hoge = "";  
  console.log("if(\"\") -->" + (hoge?true:false) ); //false
  hoge = 1;  
  console.log("if(1) -->" + (hoge?true:false) ); //true
  hoge = -1;  
  console.log("if(-1) -->" + (hoge?true:false) ); //true
  hoge = 0;
  console.log("if(0) -->" + (hoge?true:false) ); //false
  hoge = [];
  console.log("if([]) -->" + (hoge?true:false) ); //true
  hoge = true;
  console.log("if(true) -->" + (hoge?true:false) ); //true
  hoge = false;
  console.log("if(false) -->" + (hoge?true:false) ); //false

  console.log("if(undefined) -->" + (undefined?true:false) ); //false
  hoge = null
  console.log("if(hull) -->" + (hoge?true:false) ); //false

  hoge = "0"
  console.log("if(\"0\") -->" + (hoge?true:false) ); //true !!
}

function TESTjapaneseCharacters(){
  console.log(/[a-zA-Z0-9]/.test("10 little English boys"));　// 半角英数字　→ true
  
  console.log(/[\u3041-\u3096]/.test("いろはにほへとちりぬるをわかよたれそつねなら")); 　// 日本語のひらがな → true
  console.log(/[\u30A1-\u30FA]/.test("イロハニホヘトチリヌルヲワカヨタレソツネナラム"));  // 日本語のカタカナ → true
  
  console.log(/[\u3400-\u9FFF]/.test("國破山河在城春草木深"));  // CJK統合漢字拡張A、CJK統合漢字の一文字　 → true
  console.log(/[\uF900-\uFAFF]/.test("国破山河在城春草木深"));  // CJK統合漢字の一文字 → false
  console.log(/[\uF900-\uFAFF]/.test("福"));  // CJK互換漢字の一文字 → true
  
  console.log(/[\u3041-\u3096\u3400-\u9FFF]/.test("色は匂えど散りぬる我が世誰ぞ常ならむ")); // → true
  var h = /\p{Script=Hiragana}/;
  console.log(h.test("いろはにほへとちりぬるをわかよたれそつねならむ")); // Unicodeプロパティのスクリプトがサポートされている場合 → 自分の場合 false
}  

function TESTformatString(){
  console.log("** TESTformatString()");
  var string = Utilities.formatString("t%04d", 1);
  console.log(string);  
}

// RegExp.exec()のテスト。特に"g"のとき、繰り返しの動作は気をつけること
function TESTregexp(){
  console.log("** TESTregexp()");

  var text = "<@ABCD> <@EFGH> <@IJKL>";
  var regexpRet;
  var regexp = /<@([0-9A-Z]+)/g;
  //Regexp.exec(String) の"g"オプションは、１回の呼出しですべてマッチ
  //しないので繰り返し呼び出しが必要
  while ( (regexpRet = regexp.exec(text)) != null ) {
    console.log("exec:" + JSON.stringify(regexpRet));
  }
  
  //String.match(Regexp)の"g"オプションは、１回の呼出しですべてマッチ
  //するので繰り返し呼び出しが不要
  regexpRet = text.match(regexp);
  console.log("exec:" + JSON.stringify(regexpRet));
  
  //String.replace(Regexp)  これはエラーになるのでコメントアウト
  //text = null;
  //regexpRet = text.replace(/\[.*?\]/,"").split(/\n/)[0].substr(0,30);
  //console.log("null:" + JSON.stringify(regexpRet));
  
  //Regexp.test(String)
  var regexp = /abcd/;
  regexpRet =  regexp.test(null);
  console.log("Regexp.test(null) -->" + regexpRet);
  regexpRet =  regexp.test(0);
  console.log("Regexp.test(0) -->" + regexpRet);

}
