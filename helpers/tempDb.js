const TempDb = class {
    constructor() {
        this.file = {}
    }
    add_data(model, data) {
        if (!this.file[model]) {
            this.file[model] = [];
        }
        data.id = this.file[model].length ;
        this.file[model].push(data);
        return data.id
    }
    getAll(model) {
        const dataModel = this.file[model];
        if (!dataModel) {
            return []
        }
        return dataModel
    }
    getOne(model, item, value) {
        const dataModel = this.file[model];
        if (!dataModel) {
            return null
        }
        const filtered = dataModel.filter((data) => data[item] == value);
        if (!filtered.length) {
            return null
        }
        return filtered[0]
    }

    updateOne(model, item, value, data) {
        const dataModel = this.file[model];
        if (!dataModel) {
            return console.log(`no data in ${model}`);
        }
        const filtered = dataModel.filter((data) => data[item] === value);
        if (!filtered.length) {
            return console.log(`no such data in ${model}`);
        }
        const tobeUpdated = filtered[0];
        data.id = tobeUpdated.id;
        const index = dataModel.findIndex(e=>e.id == tobeUpdated.id);
        this.file[model].splice(index, 1);
        this.file[model].push(data);
    }

    replaceOne(model, item,value,data){
        const dataModel = this.file[model];
        if (!dataModel) {
            return console.log(`no data in ${model}`);
        }
        const filtered = dataModel.filter((data) => data[item] === value);
        if (!filtered.length) {
            return console.log(`no such data in ${model}`);
        }
        let tobeUpdated = filtered[0];
        let prv_id=tobeUpdated.id
        tobeUpdated={...data,id:prv_id}
        const index = dataModel.findIndex(e=>e.id == prv_id);
        this.file[model].splice(index, 1);
        this.file[model].push(data);


    }

    removeOne(model, item, value) {
        const dataModel = this.file[model];
        if (!dataModel) {
            return console.log(`no data in ${model}`);
        }
        const filtered = dataModel.filter((data) => data[item] !== value);
        this.file[model] = filtered
        return

    }
}

module.exports = TempDb