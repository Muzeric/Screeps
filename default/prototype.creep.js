var utils = require('utils');

let origMoveTo = Creep.prototype.moveTo;
Creep.prototype.moveTo = function() {
    let res = origMoveTo.apply(this, arguments);

    if (res == OK)
        this.room.needRoad(this);

    return res;
}

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

Creep.prototype.findSourceAndGo = function () {
    if (!this.memory.energyID || Game.time - (this.memory.energyTime || 0) > ENERGY_TIMEOUT) {
        if (this.findSource() == OK)
            this.memory.energyTime = Game.time;
    }
    this.gotoSource();
}

Creep.prototype.findSource = function () {    
    let memory =this.room.memory;
    let targets = (memory.structures[STRUCTURE_CONTAINER] || []).concat( (memory.structures[STRUCTURE_STORAGE] || []), (memory.structures[STRUCTURE_SOURCE] || []), (memory.resources || []) );

    if(!targets.length) {
        console.log(this.name + " no any source in room " + this.room.name);
        return;
    }

    let energyNeed = this.carryCapacity - _.sum(this.carry);
    let targetInfo = {};
    for(let target of _.filter(targets, t => t.energy)) {
        let range = this.pos.getRangeTo(target.pos.x, target.pos.y);
        let energyLeft = target.energy - (Memory.energyWanted[target.id] || 0);
        let energyTicks = (energyNeed - energyLeft) / 10;
        if (energyTicks < 0)
            energyTicks = 0;

        let cpriority = 0;
        if (target.resourceType) { // Dropped
            cpriority = this.room.memory.hostilesCount ? -100 : 2;
        } else if (target.structureType == STRUCTURE_CONTAINER && energyNeed <= energyLeft) {
            cpriority = 2;
        } else if (target.structureType == STRUCTURE_SOURCE) { // Source
            if (target.miners)
                cpriority = -100;
            else
                cpriority = -2;
        }

        targetInfo[target.id] = range * 1.2 + energyTicks - 100 * cpriority;
        //if (this.room.name == "W48N4")
        //   console.log(this.name + " [" + this.room.name + "]: targetID=" + target.id + ", range=" + range + ", energyTicks=" + energyTicks + ", energyLeft=" + energyLeft + ", cpriotiy=" + cpriority + ", energyNeed=" + energyNeed + ", sum=" + targetInfo[target.id]);
    }
    let target = targets.sort( function (a,b) {
        let suma = targetInfo[a.id];
        let sumb = targetInfo[b.id];
        //console.log("a=" + a.id + ",b=" + b.id + ",suma=" + suma + ",sumb=" + sumb);
        return suma - sumb;
    })[0];

    Memory.energyWanted[target.id] = (Memory.energyWanted[target.id] || 0) + energyNeed;
    
    //console.log(this.name + " [" + this.room.name + "] got target " + target.id + " structureType=" + target.structureType + " pos=" + target.pos.x + "," + target.pos.y);
    this.memory.energyObj = target;
    this.memory.energyID = target.id;
    return 0;
}
    
Creep.prototype.gotoSource = function() {
    let source = Game.getObjectById(this.memory.energyID);
    if(!source) {
        console.log(this.name + " [" + this.room.name + "] can't get source with enegryID=" + this.memory.energyID);
        this.memory.energyObj.energy = 0;
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
            this.memory.energyID = null;
            return;
        }
    } else {
        res = this.harvest(source);
    }
    
    if (res == ERR_NOT_IN_RANGE) {
        this.moveTo(source, { visualizePathStyle : {lineStyle: "dotted", stroke : 'green' , opacity : 0.5}, costCallback : function(name, cm) { cm.set(4, 43, 255); cm.set(4, 42, 255); cm.set(4, 41, 255); } });
    } else if (res == ERR_NOT_ENOUGH_ENERGY) {
        return;
    } else if (res < 0) {
        console.log(this.name + " tried to get energy from " + this.memory.energyID + " with res = " + res);
        this.memory.energyID = null;
    }
}