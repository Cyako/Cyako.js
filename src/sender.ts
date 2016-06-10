import {CyakoQueue} from "./queue";
import {CyakoSocket} from "./socket";

export class CyakoSender {
	public queue: CyakoQueue;
	public socket: CyakoSocket;
	constructor(queue:CyakoQueue,socket:CyakoSocket){
		this.queue = queue;
		this.socket = socket;
	}
	public send(){
		let sendUnsent = () => {
			let entries = this.queue.unsent.entries();
			let item = entries.next();
			while(!item.done){
				let request = item.value[1].request;
				this.socket.send(request)
				item = entries.next()
			}
		};
		if (this.socket.isConnected()){
			sendUnsent();
		}else{
			this.socket.connect().then(ok=>{
				sendUnsent();
			},err=>{});
		}
	}
}
