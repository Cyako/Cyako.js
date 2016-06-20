import {CyakoQueue} from "./queue";
import {CyakoTask,CyakoFetchTask,CyakoListenTask} from "./task";


export class CyakoReceiver{
	public queue: CyakoQueue;
	constructor(queue:CyakoQueue){
		this.queue = queue;
	}
	resolve(response:CyakoResponse){
		let id = response.id;
		let task: CyakoTask;
		task = this.queue.get(id);
		if(task) {
			task.handle(response);
			if(task instanceof CyakoFetchTask) {
				this.queue.setFinished(task.id);
			}
		}
	};
}

export interface CyakoResponse {
	id: string
}