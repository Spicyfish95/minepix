export class DocumentStore{
 constructor(){this.items=[];this.active=null;}
 save(state){const item=this.items.find(item=>item.id===state.documentId);if(item)item.state=state;}
 add(state){this.items.push({id:state.documentId,state});this.active=state.documentId;}
 replace(state){const index=this.items.findIndex(item=>item.id===this.active);if(index<0)this.add(state);else{this.items[index]={id:state.documentId,state};this.active=state.documentId;}}
 get(id){const item=this.items.find(item=>item.id===id);if(!item)throw new Error('文档标签已关闭');return item.state;}
 remove(id){const index=this.items.findIndex(item=>item.id===id);if(index<0)return null;this.items.splice(index,1);if(this.active===id)this.active=this.items[Math.min(index,this.items.length-1)]?.id||null;return this.active?this.get(this.active):null;}
}
