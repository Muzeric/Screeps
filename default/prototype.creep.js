var utils = require('utils');

Creep.prototype.goFromKeepers = function() {
    let target = this.room.getNearKeeper(this.pos, 10) || this.room.getNearComingLair(this.pos, 10);
    if (!target)
        return -7;
    let safePlace = this.pos.findClosestByPath(utils.getRangedPlaces(this, target.pos, 6));
    return this.moveTo(safePlace ? safePlace : Game.rooms[this.memory.roomName].controller); 
}

Creep.prototype.attackNearHostile = function(range) {
    let target = this.room.getNearHostile(this.pos, range || 5);
    if (!target)
        return -7;
        
    target = Game.getObjectById(target.id);
    if (this.attack(target) == ERR_NOT_IN_RANGE)
        this.moveTo(target);
    return 0;
}

Creep.prototype.findSourceAndGo = function (storage_priority) {
    if(!this.memory.energyID)
        this.memory.energyID = this.findSource(storage_priority);
    this.gotoSource();
}

Creep.prototype.findSource = function (storage_priority) {
    let targets = [];
    if (!this.room.memory.hostilesCount)
        targets = this.room.find(FIND_DROPPED_ENERGY, { filter: r => r.amount > 50 });
    
    targets = targets.concat( this.room.find(FIND_STRUCTURES, { filter: s =>
        (
            s.structureType == STRUCTURE_CONTAINER && 
            _.sum(Game.creeps, (c) => (c.memory.role == "miner" || c.memory.role == "longminer") && c.memory.cID == s.id)
        ) ||
        (
            s.structureType == STRUCTURE_STORAGE && 
            s.store[RESOURCE_ENERGY] > this.carryCapacity
        )
    }));

    if (this.getActiveBodyparts(WORK))
        targets = targets.concat(this.room.find(FIND_SOURCES));

    if(!targets.length) {
        console.log(this.name + " no any source in room " + this.room.name);
        return;
    }

    let targetInfo = {};
    for(let target of targets) {
        let cenergy = target.resourceType ? target.amount : (target.structureType ? target.store[RESOURCE_ENERGY] : target.energy);
        let cpath = this.pos.getRangeTo(target);
        let wantEnergy = _.reduce(_.filter(Game.creeps, c => c.memory.energyID == target.id), function (sum, value) { return sum + value.carryCapacity; }, 0);
        let cpriority = 0;
        if (target.resourceType) { // Dropped
            cpriority = 1.5;
        } else if (storage_priority && target.structureType == STRUCTURE_STORAGE || !storage_priority && target.structureType == STRUCTURE_CONTAINER) {
            cpriority = 2; 
        } else if (target.energy) { // Source
            if (_.filter(Game.creeps, c => c.memory.energyID == target.id && (c.memory.role == "longminer" || c.memory.role == "miner")).length)
                cpriority = -100;
            else
                cpriority = -2;
        }

        let cenergyTicks = (wantEnergy + this.carryCapacity - cenergy) / 10;
        //if (cenergyTicks < 0 && !target.resourceType)
        //    cenergyTicks = 0;
        targetInfo[target.id] = cpath * 1.2 + cenergyTicks - 100 * cpriority;
        //if (this.room.name == "W46N4")
        //    console.log(this.name + " [" + this.room.name + "] has target " + target.id + " in " + cpath + " with " + cenergy + " energy and " + wantEnergy + " wanted and cpriotiy=" + cpriority + " sum=" + targetInfo[target.id]);
    }
    let target = targets.sort( function (a,b) {
        let suma = targetInfo[a.id];
        let sumb = targetInfo[b.id];
        //console.log("a=" + a.id + ",b=" + b.id + ",suma=" + suma + ",sumb=" + sumb);
        return suma - sumb;
    })[0];
    
    //console.log(this.name + " got target " + target.id + " in " + cont_info[target.id].cpath + " with " + cont_info[target.id].cenergy + " energy");
    return target.id;
}
    
Creep.prototype.gotoSource = function(creep) {
    let source = Game.getObjectById(this.memory.energyID);
    if(!source) {
        console.log(this.name + " can't get source with enegryID=" + this.memory.energyID);
        this.memory.energyID = null;
        return;
    } else if (
        source.structureType &&
        source.structureType == STRUCTURE_CONTAINER &&
        !_.sum(Game.creeps, (c) => (c.memory.role == "miner" || c.memory.role == "longminer") && c.memory.cID == source.id)
    ) {
        //console.log(this.name + " has source=container without miners");
        this.memory.energyID = null;
        return;
    /*
    } else if (
        source.structureType &&
        source.structureType == STRUCTURE_CONTAINER &&
        source.store[RESOURCE_ENERGY] < this.carryCapacity
    ) {
        console.log(this.name + " has source=container without energy");
        this.memory.energyID = null;
        return;
    */
    } else if (
        source.structureType &&
        source.structureType == STRUCTURE_STORAGE &&
        source.store[RESOURCE_ENERGY] < this.carryCapacity
    ) {
        //console.log(this.name + " has source=storage without enough energy");
        this.memory.energyID = null;
        return;
    }

    if (this.room.memory.type == 'lair' && !this.goFromKeepers())
        return;
    
    let res;
    if(source.structureType && (source.structureType == STRUCTURE_CONTAINER || source.structureType == STRUCTURE_STORAGE || source.structureType == STRUCTURE_LINK)) {
        res = this.withdraw(source, RESOURCE_ENERGY);
    } else if (source.resourceType && source.resourceType == RESOURCE_ENERGY) {
        res = this.pickup(source);
        if (!res) {
            console.log(this.name + " picked up resource");
            this.memory.energyID = null;
            return;
        }
    } else {
        res = this.harvest(source);
    }
    
    if (res == ERR_NOT_IN_RANGE) {
        this.moveTo(source, { visualizePathStyle : {lineStyle: "dotted", stroke : "#"+this.name.slice(-2)+this.name.slice(-2)+this.name.slice(-2) , opacity : 0.5}, costCallback : function(name, cm) { cm.set(4, 43, 255); cm.set(4, 42, 255); cm.set(4, 41, 255); } });
    } else if (res == ERR_NOT_ENOUGH_ENERGY) {
        return;
    } else if (res < 0) {
        console.log(this.name + " tried to get energy from " + this.memory.energyID + " with res = " + res);
        this.memory.energyID = null;
    }
}