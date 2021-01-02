

const TEST_DATA_TASKLIST = 
`{"dueToday":[
      ["📩","T0837","メール","#123456","2020-12-03T08:00:00.000Z","2020-12-04T08:00:00.000Z","","佐藤,鈴木、田中","対応中","タスク１","PJT管理","依頼者太郎","2020-11-06T08:00:00.000Z","〇〇について、\\n①〇〇する\\n②△△する\\n③××する","","","T://aa/bb/cc.xls","2期","","","","","","佐藤、鈴木","田中","","全員","斉藤、池田","","全員","","","〇","〇","●",""],
      ["📩","T0837","メール","#123456","2020-12-03T08:00:00.000Z","2020-12-04T08:00:00.000Z","","佐藤,鈴木、田中","対応中","タスク１","PJT管理","依頼者太郎","2020-11-06T08:00:00.000Z","〇〇について、\\n①〇〇する\\n②△△する\\n③××する","","","T://aa/bb/cc.xls","2期","","","","","","佐藤、鈴木","田中","","全員","斉藤、池田","","全員","","","〇","〇","●",""]],
 "dueNextBusDay":[
      ["📩","T0837","メール","#123456","2020-12-03T08:00:00.000Z","2020-12-04T08:00:00.000Z","","佐藤,鈴木、田中","対応中","タスク１","PJT管理","依頼者太郎","2020-11-06T08:00:00.000Z","〇〇について、\\n①〇〇する\\n②△△する\\n③××する","","","T://aa/bb/cc.xls","2期","","","","","","佐藤、鈴木","田中","","全員","斉藤、池田","","全員","","","〇","〇","●",""]
      ],
 "pendAssign":[
      ["📩","T0837","メール","#123456","2020-12-03T08:00:00.000Z","2020-12-04T08:00:00.000Z","","佐藤,鈴木、田中","対応中","タスク１","PJT管理","依頼者太郎","2020-11-06T08:00:00.000Z","〇〇について、\\n①〇〇する\\n②△△する\\n③××する","","","T://aa/bb/cc.xls","2期","","","","","","佐藤、鈴木","田中","","全員","斉藤、池田","","全員","","","〇","〇","●",""]
        ],
          "weekly":[7,4,3,5] 
     }`;

function reviver (key, value) {
  return /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/.test(value) ? new Date(value) : value;
}
/***********************************************************************************
         上位レベル　スラッシュコマンド単位の機能
************************************************************************************/
function clearCache(){
  CacheService.getScriptCache().remove(DEF_COLUMN_TASK);
}

function TESTgetCompletedTaskOwners(){
  var dataRow = Array(30);
  var cacheService = CacheService.getScriptCache();
  var member = {"鈴木":[,,], "田中":[,,],"佐藤":[,,]};
  cacheService.put(DEF_MEMBER, JSON.stringify(member), 21600); 
  var col  = columnNameMapForArrayIndex();
  var ret;
  dataRow[col("メモ")] = "鈴木";
  ret = getCompletedTaskOwners(dataRow);
  if( ret.toString() != [].toString() ){throw new Error("test failed")}

  dataRow[col("メモ")] = "鈴木\n田中完了";
  ret = getCompletedTaskOwners(dataRow);
  if( ret.toString() != ["田中"].toString() ){throw new Error("test failed")}

  dataRow[col("メモ")] = "鈴木\n田中、佐藤完了\n鈴木";
  ret = getCompletedTaskOwners(dataRow);
  if( ret.toString() != ["田中","佐藤"].toString() ){throw new Error("test failed")}

  dataRow[col("メモ")] = "鈴木\n田中、佐藤完了鈴木";
  ret = getCompletedTaskOwners(dataRow);
  if( ret.toString() != ["田中","佐藤"].toString() ){throw new Error("test failed")}
  
  cacheService.remove(DEF_MEMBER);


}
function TESTtaskack(){
  var ret = taskack("T864 了解","U9ST58P4L","1608162195.000100");
  console.log(ret);
}

function TESTtaskcomplete(){
  var ret = taskcomplete("T864 完了","U9ST58P4L","1608162195.000100");
  console.log(ret);
}
/***********************************************************************************
        　中レベル　
************************************************************************************/


function testinsertNewTask(){
  CacheService.getScriptCache().remove(SHEET_TASK);
  var current = PropertiesService.getScriptProperties().getProperty("nextTaskID");
  var newTaskRange = insertNewTask({期日:"2020/12/20",Redmine:"#123456",メール件名:"あれやこれや",タスク依頼者:"Dさん"});
  var next = PropertiesService.getScriptProperties().getProperty("nextTaskID");

  console.log(current + " -> " + next + "[" + newTaskRange + "]");
}

function testtranslateHashToArray(){
  CacheService.getScriptCache().remove("task");
  var data = {期日:"2020/12/20",Redmine:"#123456",メール件名:"あれやこれや",タスク依頼者:"Dさん"};
  var result = translateHashToExcelRow("col_def_task",data);
  console.log(result);
}


/***********************************************************************************
        　下位レベル　共通機能　
************************************************************************************/

function testhasNestedKey(){
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




function testextractDueDate(){
  var ret = extractDueDate("なんちゃら11/25かんちゃら");
  if ( ret != "2020/11/25" ) {
    throw new Error("Test Fail: #1 ["+ret+"]");  
  }
  ret = extractDueDate("なんちゃら2020/11/25かんちゃら");
  if ( ret != "2020/11/25" ) {
    throw new Error("Test Fail: #2 ["+ret+"]");  
  }
  ret = extractDueDate("なんちゃら2020年11月25日かんちゃら");
  if ( ret != "2020/11/25" ) {
    throw new Error("Test Fail: #3 ["+ret+"]");  
  }
  ret = extractDueDate("なんちゃら11月25日かんちゃら");
  if ( ret != "2020/11/25" ) {
    throw new Error("Test Fail: #4 ["+ret+"]");  
  }
  ret = extractDueDate("なんちゃら1/25かんちゃら");
  if ( ret != "2021/01/25" ) {
    throw new Error("Test Fail: #5 ["+ret+"]");  
  }
  ret = extractDueDate("なんちゃら2021/1/25かんちゃら");
  if ( ret != "2021/01/25" ) {
    throw new Error("Test Fail: #5 ["+ret+"]");  
  } 
  
  ret = extractDueDate("なんちゃら２０２０/１１/２５かんちゃら");
  if ( ret != "2020/11/25" ) {
    throw new Error("Test Fail: #6 ["+ret+"]");  
  }    
  

}

function testtranslateHashToArray(){
  CacheService.getScriptCache().remove("task");
  var data = {期日:"2020/12/20",Redmine:"#123456",メール件名:"あれやこれや",タスク依頼者:"Dさん"};
  var result = translateHashToExcelRow("col_def_task",data);
  console.log(result);
}

function testextractRedmine(){
  var ret = extractRedmine("なんちゃら#12345かんちゃら");
  if ( ret != "#12345" ) {
    throw new Error("Test Fail: #1 ["+ret+"]");  
  }
  ret = extractRedmine("なんちゃら#123456かんちゃら");
  if ( ret != "#123456" ) {
    throw new Error("Test Fail: #2 ["+ret+"]");  
  }
  ret = extractRedmine("なんちゃら#１２３４５６かんちゃら");
  if ( ret != "#123456" ) {
    throw new Error("Test Fail: #3 ["+ret+"]");  
  }

}


function TESTgetUserOfficeNameBySlackUserID(){ 
  var ret = getUserOfficeNameBySlackUserID("aaa");
  if( ret != null) { throw new Error("test failed") }
  ret = getUserOfficeNameBySlackUserID("U9ST58P4L");
  if( ret != "鈴木靖") { throw new Error("test failed") } 
  
}


function TESTisReadyToWork(){
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
  console.log("complete");
}
function TESTisCloseable(){

  //完了報告欄、担当者欄
  var ret = isCloseable(["鈴木"],["鈴木、田中"]);
  if (   ret ) { throw new Error("test failed") } else { console.log(ret) }
  ret = isCloseable(["鈴木","田中"],["鈴木","田中"]) 
  if ( ! ret ) { throw new Error("test failed") } else { console.log(ret) }
  ret = isCloseable(["鈴木","田中","佐藤"],["鈴木","田中"])
  if ( ! ret ) { throw new Error("test failed") } else { console.log(ret) }
  ret = isCloseable(null,["鈴木","田中"]);
  if (   ret ) { throw new Error("test failed") } else { console.log(ret) }
  ret = isCloseable([],["鈴木","田中"]);
  if (   ret ) { throw new Error("test failed") } else { console.log(ret) }
  ret = isCloseable([],[]);  
  if (   ret ) { throw new Error("test failed") } else { console.log(ret) }
  ret = isCloseable(["鈴木"],[]);
  if ( ! ret ) { throw new Error("test failed") } else { console.log(ret) }
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

function testformatString(){
  var string = Utilities.formatString("t%04d", 1);
  console.log(string);  
}


// RegExp.exec()のテスト。特に"g"のとき、繰り返しの動作は気をつけること
function testregexp(){
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

function testgetNextWorkDays(){
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
function TESTgetDefinitionFromCache(){
  DEF_ITEM_LIST.forEach( e => CacheService.getScriptCache().remove(e)); 
  DEF_ITEM_LIST.forEach(function(e){
    var ret = getDefinitionFromCache(e);
    console.log(e + ": "+JSON.stringify(ret));
  });
}


function TESTlistTask(){
 var ret = listTask(); 
  
}

function TESTprotectRange(){
  protectTaskSheet();
  removeProtection();
}


function TESTgetUserEmailAddresses(){
  var cacheService = CacheService.getScriptCache();
  var member = {"鈴木":["test@gmail.com",,], "田中":["test2@gmail.com",,],"佐藤":["",,]};
  cacheService.put(DEF_MEMBER, JSON.stringify(member), 21600); 
  var ret;
  ret = getUserEmailAddresses();
  console.log(ret);
  
  cacheService.remove(DEF_MEMBER);

}

function testfindRowByTaskID(){
  if( 904 != findRowByTaskID("t0900")){throw new Error("test failed")}
  if( 904 != findRowByTaskID("t900")){throw new Error("test failed")}
  if( 904 != findRowByTaskID("T0900")){throw new Error("test failed")}
  if( 904 != findRowByTaskID("T900")){throw new Error("test failed")}
  if( null != findRowByTaskID("Txxx")){throw new Error("test failed")}
  if( null != findRowByTaskID("T9999")){throw new Error("test failed")}
}


function testdiffWorkingDays(){
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

function testfindMaxTaskID(){
  var stop = stopWatch();
  var ret = findMaxTaskID2();
  console.log("Elapsed " + stop() + " ms " + ret );

}

function testfindRowByTaskID(){
  var stop = stopWatch();
  var ret = findRowByTaskID("t0002");
  console.log("Elapsed " + stop() + "ms  result:" + ret);
  
  stop = stopWatch();
  ret = findRowByTaskID("t9999");
  console.log("Elapsed " + stop() + "ms  result:" + ret); 

  stop = stopWatch();
  ret = findRowByTaskID("T0898");
  console.log("Elapsed " + stop() + "ms  result:" + ret); 
}

                         
function testcolumnNameMap(){
  CacheService.getScriptCache().remove(DEF_COLUMN_TASK);
  var col = columnNameMapForA1Notation();
  console.log(col("タスクID"));
  //console.log(col("タスクXX"));
  //console.log(col(null));
  col = columnNameMapForRange();
  console.log(col("タスクID"));
  //console.log(col("タスクXX"));
  //console.log(col(null));
  col = columnNameMapForArrayIndex();
  console.log(col("タスクID"));
}

function testisBusinessDay(){
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

function testdateDiff(){
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

function testconvertToLetter(){
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

function testNullCheck(){
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

function TESTtoDateShortString(){
  toDateShortString("2020/12/01");
}


function testgetComingFriday(){
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
/***********************************************************************************
        　下位レベル　共通機能 Slack系　
************************************************************************************/


function testslackConversationOpenByUserID(){

}

function testslackSendMessageToTeam(){
    var debug_msg = [...Array(5)].map(x => x="成功：@Taro タスク[太郎]の担当者にT0837さんを追加しました").join("\n");
  var ret =[];
  ret.unshift({type: "section",
               text: {
                 type: "mrkdwn",
                 text: "<https://docs.google.com/spreadsheets/d/1jVXk7dFdn7fQWStyc3L5_dDXhp8ov75WecOth2msAUI/edit#gid=577452844|要回答など期限管理>\nタスク引受と完了のコマンド処理が完了しました。<成功>は管理簿の更新が成功\nできたもの。 <無効>はコマンド処理が無視されたものです。"+debug_msg
               }});
  slackSendMessageToTeam(JSON.stringify(ret));
}
