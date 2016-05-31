import {CyakoQueue} from "./queue";
import {CyakoTask} from "./task";

export class Cyako {
    constructor(url) {
        this.url = url;
        this.websocket;
        this.queue = [];
        this.queue.queuedNum = function(){
        	let num = 0;
        	for (let item of this){
        		if (item.isQueued()) {
        			num++;
        		}
        	}
        	return num;
        };
        this.queue.sentNum = function(){
        	let num = 0;
        	for (let item of this){
        		if (item.isSent()) {
        			num++;
        		}
        	}
        	return num;
        };
        this.queue.getFirstQueued = function () {
            for (let item of this) {
                if (item.isQueued()) {
                    return item;
                }
            }
        };
        this.queue.clear = function(){
            this.splice(0,this.queue.length);
        };
        this.queue.clearResolveAndReject = function(){
             let num = this.length;
             while (num--) {
                 let item = this.pop();
                 if (!item.isResolve()&&!item.isReject()) {
                    this.push(item);
                 }
             }
        };
        this.listenIdList = [];
        this._requestOrder = 0;
        this.MAX_WAITING_NUM = 64;
        this.CONTINUE_SEND_REST_DELAY = 10;
        this.CONTINUE_SEND_REST_RATIO = 0.6;
        this.REQUEST_TIMEOUT = 150;
        this.PROMISE_TIMEOUT = 6400;
        // this.CONNECTION_TIMEOUT = 4000;
        this._connect();
    };

    _isConnected() {
        return this.websocket && this.websocket.readyState === 1;
    };

    _sendQueueRequests() {
        if (this._isConnected()) {
        	if (this.queue.sentNum() <= this.MAX_WAITING_NUM*this.CONTINUE_SEND_REST_RATIO) {
        		let sendNum = Math.min(this.queue.queuedNum(),this.MAX_WAITING_NUM-this.queue.sentNum());
            	while (sendNum--) {
            	    let w = this.queue.getFirstQueued();
            	    this.websocket.send(JSON.stringify(w.request));
            	    w.startTiming(this.REQUEST_TIMEOUT);
            	    w.setSent();
            	}
        	}
        	if (this.queue.queuedNum()>0) {
        		this._continueSendRest();
        	}
        }else{
        	this._connect();
        }
    };

    _continueSendRest(){
    	//console.log('RETRY');
    	setTimeout(()=>{
    		this._sendQueueRequests();
    	}, this.CONTINUE_SEND_REST_DELAY);
    };

    do(method, params, data) {
        return new Promise((resolve, reject) => {
            // add new task.
            let w = new CyakoTask((this._requestOrder++) + '.' + method, method, params, data);
        	w.onreceive = (data) =>{
        		w.setResolve();
                data.params = JSON.parse(data.params);
                while (typeof data.data==="string") {
                    data.data=JSON.parse(data.data)
                }
            	resolve(data);
            	return;
        	};
        	//console.log('METHOD: Send.');
        	this.queue.push(w);
        	// do task in queue
        	this._sendQueueRequests();
        	// timeout
        	w.ontimeout = ()=>{
        		w.setReject();
        		reject('Request Timeout.');
        	};
        	setTimeout(() => {
        		w.setReject();
        		reject('Promise Timeout.');
        	},this.PROMISE_TIMEOUT);
    	});
    };

    on(id,callback){
    	this.listenIdList.push({
    		id:id,
    		onreceive:callback
    	})
    };

    clear(){
        this.queue.clear();
    };

    // connection
    _connect() {
        // if no websocket has been initialed or the websocket has been closed
    	if (!this.websocket || this.websocket.readyState===3) {
        	//console.log('SOCKET: Try to connect.');
        	this.websocket = new WebSocket(this.url);
        	this.websocket.onopen = (event) =>{
        	    //console.log('SOCKET: Open.');
        	    // send all requests in queue
        	    //console.log('SOCKET: Start Clearing the Queue.');
        	    this._sendQueueRequests();
        	};
        	this.websocket.onmessage = (event) =>{
        	    let data = JSON.parse(event.data);
        	    //console.log('SOCKET: Message.', data.id);
        	    // match and clear 1 request.
        	    let havntMatch = true;
        	    this.queue.map((w, i) => {
        	        if(havntMatch && w.isSent() &&w.id === data.id){
        	        	//console.log("METHOD: Catch matched response: " + w.id);
        	        	w.onreceive(data);
        	        	havntMatch = false;
        	        }
        	    })
        	    this.listenIdList.forEach((item,i)=>{
        	    	if (item.id===data.id) {
        	    		item.onreceive()
        	    	}
        	    })
        	};
        	this.websocket.onclose = () =>{};
        	this.websocket.onerror = () =>{};
    	}    
    };

    disconnect() {
        if (this._isConnected()) {
            this.websocket.close();
            //console.log('SOCKET: Close.');
        }
    };
}