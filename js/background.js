var framegrabToDisplay = {};


function transactionErrorHandler(error) {
    alert("Transaction error: " + error.message + ", code: " + error.code);
}
 
function transactionSuccessHandler() {
//    alert("Transaction successful.");
}

function queryErrorHandler(transaction, error) {
	// !!!hack -- not sure of a better way...
	if (error.message === "constraint failed") {
		alert("A framegrab has already been saved for this time.");
	} else {
	    console.log("Sorry -- something went wrong: " + error.message + ", code: " + error.code + 
			". Sam Dutton would appreciate if you could email this error to sam.dutton@gmail.com.");
	}
	
    return false;
}
 
var db = openDatabase('framegrabs', '1.0', 'Framegrabs', 1024 ^ 1024); // short name, version, display name, max size (made up number...)
db.transaction(function (tx) {
//	tx.executeSql('DROP TABLE IF EXISTS framegrabs');
	tx.executeSql('CREATE TABLE IF NOT EXISTS framegrabs (dataUrl, pageTitle, pageUrl, timecode FLOAT(2), videoSrc, UNIQUE(pageUrl, videoSrc, timecode))', 
		[], null, queryErrorHandler);
}, transactionErrorHandler, transactionSuccessHandler);

function showResults(transaction, results) {
	if (results.rows && results.rows.length > 0) {
		var i, message = "", prop;
		for (i = 0; i !== results.rows.length; ++i) {
			message += "Item " + i + "\n";
			var row = results.rows.item(i);
			for (prop in row) {
				if (row.hasOwnProperty(prop)) {
					message += prop + ": " + row[prop] + "\n";
				}
			}
			message += "\n";
		}
		if (message !== "") {
			alert(message);
		}	
	}
}

function handleResults(tx, results, callback) {
	callback(results.rows);
}

// see also doReadQuery() below
function doQuery(statement, querySuccessHandler, parameters) {
	db.transaction(function (tx) {
		tx.executeSql(statement, parameters, querySuccessHandler, queryErrorHandler);
	}, transactionErrorHandler, transactionSuccessHandler);
}

// uses Database readTransaction() method, supposedly faster than transaction()
function doReadQuery(statement, querySuccessHandler, parameters) {
	db.readTransaction(function (tx) {
		tx.executeSql(statement, parameters, querySuccessHandler, queryErrorHandler);
	}, transactionErrorHandler, transactionSuccessHandler);
}

function getData(statement, callback) {
	doReadQuery(statement, 
		function(tx, results) { // query success handler
			handleResults(tx, results, callback);		
	});
}

function storeFramegrab(request) {
	// don't know why this doesn't work
	//	var statement = "BEGIN IF NOT EXISTS (SELECT * FROM framegrabs WHERE pageUrl = '" + request.pageUrl + "' AND videoSrc = '" + request.videoSrc + 
	//	"' AND timecode = '" + request.timecode + "') THEN INSERT INTO framegrabs (dataUrl, pageTitle, pageUrl, timecode, videoSrc) VALUES (?, ?, ?, ?, ?) END";

	var statement = "INSERT INTO framegrabs (dataUrl, pageTitle, pageUrl, timecode, videoSrc) VALUES (?, ?, ?, ?, ?)";
	doQuery(statement, null, [request.dataUrl, request.pageTitle, request.pageUrl, request.timecode, request.videoSrc]);
}

function deleteFramegrabs(pageUrl, videoSrc) {
    doQuery("DELETE FROM framegrabs WHERE pageUrl = '" + pageUrl + "' AND videoSrc = '" + videoSrc + "'");
}


chrome.browserAction.setBadgeBackgroundColor({"color": [0, 200, 0, 100]});

function initBrowserAction(request) {
	if (request.numVideos > 0) {
		var numVideos = request.numVideos.toString();
		chrome.browserAction.setBadgeText({"text": numVideos});
		chrome.browserAction.setTitle({"title": numVideos + " video element(s) found on this page. \nClick to view stored framegrabs, or save framegrabs \nby using the icons overlaid on the video(s)."});
	}
}

// used from chrome://newtab/, i.e. when sending a request directly to the content script won't work
function displayFramegrabFromNewTab(tabId, request) {
    framegrabToDisplay = request;
    chrome.tabs.update(tabId, {"url": request.pageUrl}, function(tab){});
}	

chrome.extension.onRequest.addListener(
	function(request, sender, sendResponse) {
        if (request.type === "displayFramegrabFromPopup") {
			framegrabToDisplay = request;
			chrome.tabs.getSelected(null, function(tab) {
				chrome.tabs.update(tab.id, {"url": request.pageUrl}, function(tab){});
			});	
		// called from contentscript ready function
		} else if (request.type === "sendFramegrabToDisplay") {
			if (framegrabToDisplay.videoSrc) { // if a framegrabToDisplay has been set
				request = framegrabToDisplay;
				request.type = "displayFramegrabFromBackground";
				chrome.tabs.sendRequest(sender.tab.id, request, function(response) {
					framegrabToDisplay = {};
				});
			}
		} else if (request.type === "initBrowserAction") {
			initBrowserAction(request);
		}  else if (request.type === "openCanvasInNewTab") {
            chrome.tabs.create({"url": request.dataUrl, selected:false}, function(tab){
                var newWindow = window.open();
                chrome.tabs.sendRequest(tab.id, {"newWindow": newWindow}, function(response){});
            });  
		}  else if (request.type === "openFramegrabInNewTab") {
            chrome.tabs.create({"url": request.dataUrl, selected:false}, function(){});  
        } else if (request.type === "storeFramegrab") {
			storeFramegrab(request);
		} else {
			alert("Unknown request type in background.html: " + request.type);
		}
		sendResponse({}); // otherwise request stays open -- this allows request to be cleaned up
	}
);


// tab selection changed
chrome.tabs.onSelectionChanged.addListener(
	function handleSelectionChange(tabId, selectInfo) {
		chrome.browserAction.setBadgeText({"text": ""});
		chrome.browserAction.setTitle({"title": "No video elements found on this page. \nClick to view framegrabs saved from other pages."});
		chrome.tabs.sendRequest(tabId, {"type": "sendNumVideos"}, initBrowserAction);
	}
);


// e.g. tab url changed
chrome.tabs.onUpdated.addListener(
	function handleUpdate(tabId, selectInfo) {
		chrome.browserAction.setBadgeText({"text": ""});
		chrome.browserAction.setTitle({"title": "No video elements found on this page. \nClick to view framegrabs saved from other pages."});
		chrome.tabs.sendRequest(tabId, {"type": "sendNumVideos"}, initBrowserAction);
	}
);

