var app = angular.module('popup', []);
app.controller('control', function($scope, $timeout){

	// init
	$scope.init = function(background){
		console.log('initializing popup');
		chrome.cookies.get({url: 'https://pan.baidu.com/', name: 'BDUSS'}, function(cookie){
			var bduss = cookie? cookie.value:'';
			if(!bduss)$scope.$apply(function(){
				$scope.message = 'You need to login first!';
				console.log($scope);
			});
			else{
				$scope.execute(background);
			}
		});
	};

	$scope.execute = function(background){
		var page = background.page;
		chrome.tabs.getSelected(null, function(tab){
			var tab_url = new URL(tab.url);
			if(tab_url.host == 'yun.baidu.com')tab_url.host = 'pan.baidu.com';
			if(!page || !page.url || tab_url != page.url.href){
				background.refresh(new URL(tab.url));
				$scope.init(background);
				return;
			}
			$scope.$apply(function(){
				$scope.message = 'Starting...\n';
				$scope.fileList = page.fileList.fileList;
				$scope.page = page;
				$scope.vcode = page.vcode;
				$scope.input = '';
				$scope.background = background;
				$scope.textarea = angular.element(document.getElementById('copy'));
				$scope.rpc = background.config.rpcList[background.config.rpcIdx];
				$scope.optionsPage = "chrome://extensions/?options="+chrome.runtime.id;
			});
		});
	};
	// refresh page
	$scope.clear = function(){
		$scope.fileList = [];
		$timeout(function(){
			$scope.background.refresh($scope.background.page.url);
		});
		$scope.message = 'Refreshing...\n';
	};
	// generate hlinks for checked items
	$scope.generate = function(){
		var filtered = $scope.fileList.filter(function(file){
			if(file.check)return true;
		});
		$timeout(function(){
			$scope.background.generate(filtered);
		});
		$scope.uncheckAll();
	};
	// copy link to clipboard
	$scope.copy = function(idx, type){
		if(type == 'hlink')$scope.textarea.val($scope.fileList[idx].hlinks[0]);
		else $scope.textarea.val($scope.fileList[idx].glink);
		if(!$scope.textarea.val()){
			$scope.log("This field is empty");
			return;
		}
		$scope.textarea[0].select();
		if(document.execCommand("copy"))$scope.log("Copy success");
		else $scope.log("Copy failure");
		$scope.textarea.val('');
	};
	// copy all links to clipboard
	$scope.copyAll = function(type){
		var links = [];
		for(var i=0; i<$scope.fileList.length; i++){
			if(type == 'glink'){
				if(!$scope.fileList[i].glink)continue;
				links.push($scope.fileList[i].glink);
			}
			else{
				if(!$scope.fileList[i].hlinks)continue;
				links.push($scope.fileList[i].hlinks[0]);
			}
		}
		$scope.textarea.val(links.join('\n'));
		if(!$scope.textarea.val()){
			$scope.log("No links");
			return;
		}
		$scope.textarea[0].select();
		if(document.execCommand("copy"))$scope.log("Copy all success");
		else $scope.log("Copy failure");
		$scope.textarea.val('');
	};
	// check all checker boxes
	$scope.checkAll = function(){
		for(i=0; i<$scope.fileList.length; i+=1){
			if(!$scope.fileList[i].isdir)$scope.fileList[i].check = true;
		}
	};
	// uncheck all checker boxes
	$scope.uncheckAll = function(){
		for(i=0; i<$scope.fileList.length; i+=1)$scope.fileList[i].check = false;
	};
	// download a file through rpc
	$scope.download = function(idx){
		// check glink
		if(!$scope.downloadable(idx)){
			$scope.log('Warning: HLinks should be generated before download!');
			return;
		}
		$timeout(function(){
			$scope.background.page.downloadFile($scope.fileList[idx]);
		});
	};

	// check whether a file is downloadable
	$scope.downloadable = function(idx){
		if(!$scope.fileList[idx].hlinks || $scope.fileList[idx].hlinks.length <= 1)return false;
		return true;
	};

	// download all files through rpc
	$scope.downloadAll = function(){
		var downloaded = false;
		$scope.fileList.forEach(function(file, idx){
			if(!$scope.downloadable(idx))return;
			downloaded = true;
			$scope.download(idx);
		});
		if(!downloaded)$scope.log('Warning: No downloadable file');
	};
	// refresh vcode
	$scope.refresh = function(){
		$timeout(function(){
			new $scope.background.Error(-20).handle();
		});
	};
	// verify and get glinks
	$scope.verify = function(input){
		$timeout(function(){
			$scope.background.page.getGLinks(function(){}, true, $scope.vcode, input);
		});
		$scope.input = '';
	};
	// check whether this page is a share page
	$scope.pageCheck = function(){
		return !$scope.page || $scope.page instanceof $scope.background.SharePage;
	};
	// on rpc change
	$scope.rpcChange = function(){
		let idx = $scope.background.config.rpcList.indexOf($scope.rpc);
		$scope.background.config.rpcIdx = idx;
	};
	$scope.openOptionPage = function(){
		chrome.runtime.openOptionsPage();
	};

	$scope.prev = function(){
		$timeout(function(){
			$scope.background.page.prev();
		});
	};

	$scope.next = function(){
		$timeout(function(){
			$scope.background.page.next();
		});
	};

	$scope.log = function(msg){
		$scope.message += msg+'\n';
		$scope.scrollDown();
	};

	$scope.scrollDown = function(){
		var element = document.getElementById("log");
		element.scrollTop = element.scrollHeight;
	};

	// start init
	$scope.init(chrome.extension.getBackgroundPage());

});

