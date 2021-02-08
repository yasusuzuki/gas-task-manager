インストールの仕方
=================
 1. Slackのチームのチャネル(なんでもよい)に専用のSlackアプリをインストールする
    - Slackアプリは、chat:write, im:write, channels:read, im:readの権限が必要
    - Slackアプリの代わりにWeb Incoming Hooksでもよいが、少しコードの収支絵が必要
    - 補足：Slackアプリをインストールしていないチャネルへの投稿はできません。
    - 補足：Slackをインストールしたくない場合は、任意のWeb Incoming Hooksでも動作するはずだ、スクリプトを少し修正する必要がある。
 2. 管理簿をGoogle Driveに作成する(必要なものは、タスク管理簿シート、定数シート、ユーザログシート、システムログシート、”祝日”という名前付き範囲)
    - 補足：　定数シートと”祝日”という名前付き範囲はキャッシュにいれるため、変更したらreset()を呼び出すこと
    - 補足：　定数シートは、インストール先環境にあわせて修正すること
    - 補足：　特に動作確認中の場合は、定数シートの「ENV_DEV_OR_PROD」をDEVにしておくこと。DEVにしても、本番の管理簿を見に行ってしまうが、
    　　　　Slackメッセージは開発者へ送られる
 3. 下の２つを定期実行に登録する
    - dailyMorningJob() --- 毎朝１回の定期実行
      - summaryReport()
      - sanityCheck()
    - scheduledPollingCommandsFromSlack() --- おおむね２０分に一回の定期実行
 4. 初回実行で誤作動を起こさないようにScript Propertiesをすべて削除しておく
 5. reset()関数を呼び、初期化する
 以上で、インストール完了。毎朝dailyMorningJob()が直近期日のタスクをレポートしてくれて、Slackのチームチャネルにタイプした完了/了解コマンドを呼んでタスク管理簿を更新してくれる

改修後のリリースの仕方
=====================
Google Apps Scriptは、コードを修正すると即反映してしまいます。そのため、テストする前の修正版スクリプトがチームメンバーのSlackメッセージを
勝手に読み取らないように、開発メンバーのSlackチャネルを受信するように環境設定を変えてから、修正作業を行ってください。
 1. SHEET_DEFで定義されたシートに「ENV_DEV_OR_PROD」という設定項目があります。これをPRODからDEVに変更してください
 2. スクリプト内のreset()という関数を呼び出してください。環境設定がDEVに変わります。
 3. 念のため、プロジェクト設定から「ENV」というプロパティがDEVに変わっているか確認します。
 4. スクリプトを修正し、適宜テストしてください。DEV環境では、SHEET_DEFで定義されたシートに「DEVELOPER_SLACK_ID」
    というSlack ユーザIDに紐づく個人チャネルを読み書きするようになります。
 5. テストが終わったら「ENV_DEV_OR_PROD」をPRODに変えて、もう一度reset()を実行します。環境設定がPRODに変わります。
 6. 念のため、プロジェクト設定から「ENV」というプロパティがPRODに変わっているか確認します。
 
 
修正履歴とTODO
============== 
 - 済　祝日をキャッシュにいれる。性能改善
 - 済　キャッシュロードは、全カテゴリを一度にいれる
    　　祝日の名前付き範囲がない場はエラー
 - 済　LAST_MESSAGE_TSはDEVとPRODで両方作る。DEV環境でテストしているときのPROD環境でのメッセージを
  　　　　逃さないためプロテクションを実施する
 - 済　2020/12/15 コマンドをT0906だけでなくT906も受け付けるように修正。ただし、0を省けるのは最大１つまで。
　　　　T10だと他と混同する可能性があるため。
 - 済　2020/12/15 担当者欄のフォーマット処理の正規表現にgオプションが足りないため、改行が残ったまま期日リマインダー
　　　　が表示されてしまう問題を修正。
 - 済　2020/12/16 isReadyToWorkやisReadyToCloseのsupがブランクのときにfalseにするようにした
 - 済　５営業日以内、ではなく今週末という計算の仕方
 - 済　申請承認・収受も含めて完了判定
 - 済　誰かが完了報告時に、未完了をレポートする
 - 済　2020/12/17　PropertiesにENV　DEV?PROD?を登録
 - PEND　タスク番号をハイパーリンクにする
 - 済　2020/12/23 タスク重複をチェックする
 - PEND Gmail経由で了解・完了コマンドを実行できるようなＷｅｂＵＩ
 - 済　2021/2/8　Slack処理が完了したときに表れるデスクトップ通知「このコンテンツは表示できません」を別のテキスト"処理が完了しました"に置き換える
 - 済　2021/2/8　性能問題１　isBusinessDay()が遅く、diffWorkingDays()が１呼び出しあたり100ms程度かかってしまうので、一時措置でグローバル変数にキャッシュする仕様とした。完全な解決策を検討する必要がある。
   - 一時措置として、TMP_HOLIDAYSというグローバル変数に読み込むようにしておいた
 - PEND  性能問題２　listTask()内でエラーをシステムログシートに追記する処理が遅い。３回エラーを記録すると１０秒程度。
 - 済　2021/2/8 3000文字を超えるメッセージを送信するとエラーになる問題を、3000文字ごとに分割送信して修正。
 - 済　2021/2/8 1行あたりの文字がすべて全角だと見切れてしまう問題の修正。30文字で切るのではなく、28文字で切るように変更。
 
 
