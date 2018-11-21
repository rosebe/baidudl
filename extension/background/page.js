/*
Models
*/
function BasePage()
{
	var self = this;
	self.prev = function(){
		log("prev");
		if(self.pageno > 1){
			self.pageno -= 1;
			self.execute(function(){});
		}
	};
	self.next = function(){
		log("next");
		if(self.fileList.fileList.length == 100){
			self.pageno += 1;
			self.execute(function(){});
		}
	};
	self.downloadFile = function(file){
		log('start downloading...');
		new DownloadManager(file).download();
	};
}
function SharePage(url)
{
	var self = this;
	BasePage.call(self);
	// init
	self.init = function(url){
		log('initializing share page...');
		self.url = url;
		self.pageno = 1;
		self.vcode = false;
		self.extra = '';
		self.yunData = [];
		self.fileList = [];
		chrome.cookies.get({url: 'https://pan.baidu.com/', name: 'BDUSS'}, function(cookie){
			self.bduss = cookie? cookie.value:'';
		});
	};

	// get verification parameter extra
	self.getExtra = function(cb){
		log('getting parameter extra...');
		chrome.cookies.get({url: 'https://pan.baidu.com/', name: 'BDCLND'}, function(cookie){
			if(cookie){
				var tmp = decodeURIComponent(cookie.value);
				self.extra = encodeURIComponent(JSON.stringify({sekey:tmp}));
			}
			cb();
		});
	};

	// get yunData in share page
	self.getShareYunData = function(cb){
		log('getting yunData in share page...');
		$.ajax({
			url: self.url.href,
			tryCount: 0,
			retryLimit: 5,
			success: function(html){
				// handle cases where the share page is not available
				var err1 = html.match(/<title>页面不存在<\/title>/);
				var err2 = html.match(/<title>百度网盘-链接不存在<\/title>/);
				if(err1 || err2){
					this.tryCount += 1;
					if(this.tryCount <= this.retryLimit){
						log('retry...');
						log('try count is: ' + this.tryCount);
						var tmp = this;
						setTimeout(function(){
							$.ajax(tmp);
						}, 1000);
						return;
					}
					log('Fail to get yunData in share page');
					return;
				}
				var code = html.match(/yunData\.setData\(.*\)/);
				var data = code[0].substring(16, code[0].length-1);
				var yunData = JSON.parse(data);
				self.yunData = yunData;
				cb();
			},
			error: function(res0, res1, res2){
				log(res0);
				log(res1);
				log(res2);
			}
		});
	};

	// list dir
	self.listDir = function(cb){
		log('listing dir...');
		$.ajax({
			url: 'https://pan.baidu.com/share/list?uk='+self.yunData.uk+"&shareid="+self.yunData.shareid+'&dir='+getURLParameter(self.url, 'path')+"&bdstoken="+self.yunData.bdstoken+"&num=100&order=time&desc=1&clienttype=0&showempty=0&web=1&page="+self.pageno,
			success: function(res){
				// if error is encountered
				if(res.errno != 0 ){
					new Error(res.errno).handle();
					return;
				}
				log("List dir succeeds");
				// good, we make it
				if(res.list.length == 0){
					return;
				}
				self.fileList = new FileList(res.list);
				updatePopup();
				cb();
			}
		});
	};

	// get glink
	self.getGLinks = function(cb, verify=false, vcode=undefined, input=undefined){
		log('getting glink list...');
		var url = "http://pan.baidu.com/api/sharedownload?sign="+self.yunData.sign+"&timestamp="+self.yunData.timestamp+"&bdstoken="+self.yunData.bdstoken+"&channel=chunlei&web=1&app_id=250528&clienttype=0";
		var data = "encrypt=0&product=share&uk="+self.yunData.uk+"&primaryid="+self.yunData.shareid;
		data += '&fid_list='+JSON.stringify(self.fileList.fsidList);
		data += "&extra="+self.extra;
		data += "&type=nolimit";
		if(verify){
			if(!vcode || !input){
				log('GLink verification error.');
				return;
			}
			data += "&vcode_str="+vcode+"&vcode_input="+input;
		}
		$.ajax({
			type: "POST",
			url: url,
			data: data,
			dataType: "json",
			success: function(res){
				if(res.errno != 0){
					new Error(res.errno).handle();
					return;
				}
				self.fileList.updateGLinks(res.list);
				if(self != page)page.fileList.updateGLinks(res.list);
				if(verify)self.vcode = false;
				updatePopup();

				self.fileList.fileList.forEach(function(e){
					if(e.glink)new Extractor(e).getHLinks();
				});
				if(cb)cb();
			}
		});
	};
	// main logic in share page
	self.execute = function(cb){
		log('share page main logic starts');
		self.getExtra(function(){
			self.getShareYunData(function(){
				var fileList = self.yunData.file_list.list;

				// handle duplicate redirections
				if((fileList.length > 1 || fileList[0].isdir) && self.url.hash.substr(0, 5) != '#list')return;

				// handle different share page
				if(self.url.hash.indexOf('list') < 0 || getURLParameter(self.url, 'path') == '%2F'){
					self.fileList = new FileList(fileList);
					updatePopup();
					self.getGLinks(cb);
				}
				else{
					self.listDir(self.getGLinks);
				}
			});
		});
	};

	self.init(url);
}

function HomePage(url)
{
	var self = this;
	BasePage.call(self);

	// init
	self.init = function(url){
		log('initializing home page');
		self.shorturl = '';
		self.shareid = '';
		self.url = url;
		self.pageno = 1;
		self.yunData = [];
		self.fileList = [];
		self.sharePage = undefined;
		chrome.cookies.get({url: 'https://pan.baidu.com/', name: 'BDUSS'}, function(cookie){
			self.bduss = cookie? cookie.value:'';
		});
	};

	// get yunData in home page
	self.getUserYunData = function(cb){
		log('getting yunData in home page...');
		$.ajax({
			url: self.url.href,
			success: function(html){
				var code = html.match(/var context={.*};/);
				code = code[0].substr(12, code[0].length-13);
				var yunData = JSON.parse(code);
				self.yunData = yunData;
				cb();
			},
			error: function(res0, res1, res2){
				log(res0);
				log(res1);
				log(res2);
			}
		});
	};

	// list dir
	self.listDir = function(cb){
		log('listing dir...');
		$.ajax({
			url: 'https://pan.baidu.com/api/list?dir='+getURLParameter(self.url, 'path')+'&bdstoken='+self.yunData.bdstoken+'&num=100&order=name&desc=1&clienttype=0&showempty=0&web=1&page='+self.pageno+'&channel=chunlei&web=1&app_id=250528',
			success: function(res){
				// if error is encountered
				if(res.errno != 0 ){
					new Error(res.errno).handle();
					return;
				}
				log("List dir succeeds");
				// good, we make it
				if(res.list.length == 0){
					return;
				}
				self.fileList = new FileList(res.list);
				updatePopup();
				cb();
			}
		});
	};

	// share file by fsidList
	self.share = function(fsidList, cb){
		$.ajax({
			type: "POST",
			url: "https://pan.baidu.com/share/set?web=1&channel=chunlei&web=1&bdstoken="+self.yunData.bdstoken+"&clienttype=0",
			data: "fid_list="+JSON.stringify(fsidList)+"&schannel=0&channel_list=%5B%5D&period=0",
			dataType: "json",
			success: function(res){
				if(res.errno != 0){
					new Error(res.errno).handle();
					return;
				}
				log("Share success");
				if(fsidList.length > 1)self.shorturl = new URL(res.shorturl+'#list/path=%2F');
				else self.shorturl = new URL(res.shorturl);
				self.shareid = res.shareid;
				cb();
			}
		});
	};

	// unshare a file by its shareid
	self.unshare = function(){
		$.ajax({
			type: "POST",
			url: "https://pan.baidu.com/share/cancel?bdstoken="+self.yunData.bdstoken+"&channel=chunlei&web=1&clienttype=0",
			data: "shareid_list=%5B"+self.shareid+"%5D",
			dataType: "json",
			success: function(res){
			if(res.errno != 0){
					new Error(res.errno).handle();
					return;
				}
				log("Unshare success");
			}
		});
	};

	self.execute = function(){
		self.getUserYunData(function(){
			self.listDir(function(){});
		});
	};

	self.init(url);
}

function SearchPage(url)
{
	var self = this;
	HomePage.call(self);

	// overwrite list dir
	self.listDir = function(cb){
		var key = getURLParameter(url, 'key');
		$.ajax({
			type: 'GET',
			url: 'https://pan.baidu.com/api/search?recursion=1&order=time&desc=1&showempty=0&page='+self.pageno+'&num=100&key='+key,
			dataType: 'json',
			success: function(res){
				// if error is encountered
				if(res.errno != 0 ){
					new Error(res.errno).handle();
					return;
				}
				log("List dir succeeds");
				// good, we make it
				if(res.list.length == 0){
					return;
				}
				self.fileList = new FileList(res.list);
				updatePopup();
				cb();
			}
		});
	};

	self.init(url);
}

function File(path, fid, isdir, md5=undefined, glink=undefined, hlinks=undefined, size=undefined)
{
	var self = this;
	self.path = path;
	self.fid = fid;
	self.isdir = isdir;
	self.md5 = md5;
	self.size = size;
	self.glink = glink;
	self.hlinks = hlinks;
	var tmp = path.split('/');
	self.name = tmp[tmp.length-1];
}

function FileList(fileList)
{
	var self = this;
	self.init = function(fileList){
		self.fileList = [];
		self.fsidList = [];
		fileList.forEach(function(e){
			var file = new File(e.path, e.fs_id, e.isdir);
			self.fileList.push(file);
			self.fsidList.push(e.fs_id);
		});
	};
	self.updateGLinks = function(fileList){
		log('updating glink list');
		fileList.forEach(function(e){
			var idx = self.fsidList.indexOf(e.fs_id);
			if(e.dlink){
				var url = new URL(e.dlink);
				self.fileList[idx].glink = url.href;
			}else{
				self.fileList[idx].glink = e.dlink;
			}
			self.fileList[idx].size = e.size;
		});
	};
	self.updateHLinks = function(file, hlinks){
		log('updating hlink list');
		var fsid = file.fid;
		var idx = self.fsidList.indexOf(fsid);
		self.fileList[idx].hlinks = hlinks;
	};
	self.updateMD5 = function(file, md5){
		var fsid = file.fid;
		var idx = self.fsidList.indexOf(fsid);
		if(self.fileList[idx].md5)return;
		log('updating md5');
		self.fileList[idx].md5 = md5;
	};
	self.init(fileList);
}

function Error(errno)
{
	var self = this;
	self.errno = errno;
	self.handle = function(){
		if(self.errno == -20){
			log('verification is required');
			$.ajax({
				url: 'https://pan.baidu.com/api/getvcode?prod=pan',
				success: function(res){
					page.vcode = res.vcode;
					updatePopup();
				}
			});
		}else{
			log('errno: '+self.errno);
		}
	};
	// 2:	wrong parameters
	// 118: no download priviledge
	// -3:	not your file
	// 110: share to frequently
}
