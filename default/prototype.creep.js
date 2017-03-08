var utils = require('utils');
var travel = require('travel');

// harvest: 0, create: 0, build: 0, repair: 0, upgrade: 0, pickup
let origHarvest = Creep.prototype.harvest;
Creep.prototype.harvest = function () {
    let res = origHarvest.apply(this, arguments);
    if (res == OK && arguments[0] instanceof Source) {
        let can = this.getActiveBodyparts(WORK) * 2;
        let was = arguments[0].energy;

        global.cache.stat.updateRoom(this.room.name, 'harvest', _.min([can, was]));
    }
    return res;
}

let origPickup = Creep.prototype.pickup;
Creep.prototype.pickup = function () {
    let res = origPickup.apply(this, arguments);
    if (res == OK && arguments[0] instanceof Resource && arguments[0].resourceType == RESOURCE_ENERGY) {
        let can = this.carryCapacity - _.sum(this.carry);
        let was = arguments[0].amount;

        global.cache.stat.updateRoom(this.room.name, 'pickup', _.min([can, was]));
    }
    return res;
}

let origBuild = Creep.prototype.build;
Creep.prototype.build = function () {
    let res = origBuild.apply(this, arguments);
    if (res == OK && arguments[0] instanceof ConstructionSite) {
        let can = this.getActiveBodyparts(WORK) * 5;
        let got = this.carry.energy;
        let was = arguments[0].progressTotal - arguments[0].progress;

        global.cache.stat.updateRoom(this.room.name, 'build', -1 * _.min([can, got, was]));
    }
    return res;
}

let origRepair = Creep.prototype.repair;
Creep.prototype.repair = function () {
    let res = origRepair.apply(this, arguments);
    if (res == OK && arguments[0] instanceof Structure) {
        let can = this.getActiveBodyparts(WORK);
        let got = this.carry.energy;
        let was = _.ceil((arguments[0].hitsMax - arguments[0].hits) / 100);

        global.cache.stat.updateRoom(this.room.name, 'repair', -1 * _.min([can, got, was]));
    }
    return res;
}

let origUpgrade = Creep.prototype.upgradeController;
Creep.prototype.upgradeController = function () {
    let res = origUpgrade.apply(this, arguments);
    if (res == OK && arguments[0] instanceof StructureController) {
        let can = this.getActiveBodyparts(WORK);
        let got = this.carry.energy;
        
        global.cache.stat.updateRoom(this.room.name, 'upgrade', -1 * _.min([can, got]));
    }
    return res;
}

Creep.prototype.moveToPos = function (a, b, c) {
    if (_.isNumber(a) && _.isNumber(b)) {
        c = c || {};
        c.withCreeps = 0;
        return [new RoomPosition(a, b, this.room.name), c];
    } else if (_.isObject(a)) {
        b = b || {};
        if (a instanceof global.RoomPosition) {
            b.withCreeps = 0;
            return [a, b];
        } else if (a.pos && a.pos instanceof global.RoomPosition) {
            b.withCreeps = a instanceof Creep ? 1 : 0;
            return [a.pos, b];
        }
    }
    return null;
}

Creep.prototype.trySubPath = function(targetPos, opts) {
    let mem = this.memory.travel;
    mem.sub = null;
    let subpath = travel.getSubFromSerializedPath(mem.path, 5, mem.iter);
    if (mem.length - mem.iter <= 5)
        subpath.push({pos: targetPos, range: 1});

    if (!subpath.length)
        return ERR_INVALID_ARGS;

    let pf = travel.getPath(this.pos, subpath, null, 1, this.room.memory.pathCache, 300);
    if (pf.incomplete) {
        console.log(this.name + ": moveTo BAD sub path from " + this.pos.getKey(1) + " to " + JSON.stringify(subpath) + "; ops=" + pf.ops + "; cost=" + pf.cost + "; length=" + pf.path.length);
        return ERR_NO_PATH;
    } else if (!pf.path.length) {
        let iter = travel.getIterFromSerializedPath(mem.path, this.pos);
        if (iter === null) { // We are near targetPos
            mem.near = this.pos.getKey(1);
            mem.here = 0;
            return this.move(this.pos.getDirectionTo(targetPos));
        }
        // Very very strange situiation
        console.log(this.name + ": moveTo STRANGE sub path from " + this.pos.getKey(1) + " to " + JSON.stringify(subpath) + "; ops=" + pf.ops + "; cost=" + pf.cost + "; length=" + pf.path.length);
        mem.iter = iter+1;
        return this.move(this.pos.getDirectionTo(travel.getPosFromSerializedPath(mem.path,mem.iter)));
    }

    mem.sub = {};
    travel.setPath(mem.sub, pf.serialized ? pf.path : travel.serializePath(pf.path), this.pos.getKey(), null, null, pf.incomplete);
    //console.log(this.name + ": moveTo got subpath from " + this.pos.getKey(1) + " to " + travel.getPosFromSerializedPath(mem.sub.path, mem.sub.length-1).getKey(1) + "; ops=" + pf.ops + "; cost=" + pf.cost + "; length=" + pf.path.length);
    return this.move(this.pos.getDirectionTo(travel.getPosFromSerializedPath(mem.sub.path,mem.sub.iter)));
}

Creep.prototype.usePath = function(memory, memkey, targetPos, opts) {
    let mem = memory[memkey];

    let iter = travel.getIterFromSerializedPath(mem.path, this.pos, utils.clamp(mem.iter-1, 0, mem.iter));
    if (iter !== null && iter >= mem.iter) {
        mem.iter = iter+1;
        mem.here = 0;
    } else if (iter === null && (mem.iter || this.pos.getKey() != mem.sourceKey)) { // Zero mem.iter may be means we are on the source pos and it's ok
        let border_iter = travel.getIterFromSerializedPath(mem.path, this.pos.invertBorderPos(), utils.clamp(mem.iter-1, 0, mem.iter));
        if (border_iter !== null) {
            //console.log(this.name + ": moveTo BUT got inverted pos, iter=" + border_iter + "; travel=" + JSON.stringify(this.memory.travel));
            return OK;
        } else {
            let key = travel.getPosFromSerializedPath(mem.path, mem.iter).getKey(1);
            console.log(this.name + ": moveTo " + memkey + " (time=" + Game.time + ") mem.iter=" + mem.iter + " (" + key + "), iter="+ iter + " (" + this.pos.getKey(1) + "); travel=" + JSON.stringify(this.memory.travel));
        }
        return null;
    }

    if (mem.iter >= mem.length) { // We are on the last position of mem.path
        // We are: 1) end sub and on the main again, so delete sub OR 2) end main, but it was incomplete, so delete main
        if (memkey == 'sub' && travel.getIterFromSerializedPath(memory.path, this.pos) !== null || mem.incomplete) {
            return null; // No movements performed
        }

        this.memory.travel.near = this.pos.getKey(1);
        this.memory.travel.here = 0;
        return this.move(this.pos.getDirectionTo(targetPos)); // This is main path and we are on the last pos OR sub path have gone to targetPos
    } 

    if (mem.here > PATH_TIMEOUT) {
        if (this.pos.isBorder())
            console.log(this.name + ": moveTo (" + targetPos.getKey(1) + ") " + memkey + " too much here iter=" + mem.iter + ", here=" + mem.here + ", pos=" + this.pos.getKey(1));
        return this.trySubPath(targetPos, opts);
    } else {
        let res = this.move(this.pos.getDirectionTo(travel.getPosFromSerializedPath(mem.path,mem.iter)));
        if (res == OK)
            mem.here++;
        return res;
    }

    return null;
}

Creep.prototype.travelTo = function (targetPos, opts) {
    if (this.fatigue > 0)
        return ERR_TIRED;
    
    let memory = this.memory;
    if (this.pos.isEqualTo(targetPos)) {
        memory.travel = null;
        return OK;
    }
    let targetKey = targetPos.getKey(1);
    
    if (memory.travel && memory.travel.targetKey == targetKey) {
        if (memory.travel.near) {
            if (memory.travel.near == this.pos.getKey(1)) {
                memory.travel.here++;
                if (memory.travel.here > PATH_TIMEOUT && this.pos.roomName == targetPos.roomName && !this.pos.isNearTo(targetPos) ) {
                    memory.travel.near = null;
                } else 
                    return this.move(this.pos.getDirectionTo(targetPos));
            } else {
                memory.travel.near = null;
            }
        }

        //console.log(this.name + ": moveTo use travel for " + targetKey + ", iter=" + memory.travel.iter + ", here=" + memory.travel.here + ", pos=" + this.pos.getKey());
        if (memory.travel.sub && memory.travel.sub.length) {
            let res = this.usePath(memory.travel, 'sub', targetPos, opts);
            if (res === null)
                memory.travel.sub = null;
            else
                return res;
        }

        let res = this.usePath(memory, 'travel', targetPos, opts);
        if (res === null)
            memory.travel = null;
        else
            return res;
    }

    
    memory.travel = {};
    let pathCache = this.room.memory.pathCache;
    let sourceKey = this.pos.getKey();
    let maxOps = PATH_OPS_LIMIT_LONG;
    let addCreeps = 0;
    if (targetPos.roomName == this.pos.RoomName) {
        if (this.pos.getRangeTo(targetPos) < 6) {
            maxOps = PATH_OPS_LIMIT_SHORT;
            addCreeps = 1;
        } else {
            maxOps = PATH_OPS_LIMIT_ROOM;
        }
    }
    if (opts.withCreeps)
        addCreeps = 1;

    let pf = travel.getPath(this.pos, {pos: targetPos, range: 1}, targetKey, addCreeps, this.room.memory.pathCache, maxOps);
    if (pf.incomplete) {
        console.log(this.name + ": moveTo BAD path from " + this.pos.getKey(1) + " to " + targetKey + "; ops=" + pf.ops + "; cost=" + pf.cost + "; length=" + pf.path.length);
        Game.notify(this.name + ": moveTo BAD path from " + this.pos.getKey(1) + " to " + targetKey + "; ops=" + pf.ops + "; cost=" + pf.cost + "; length=" + pf.path.length);
    }

    if (pf.path.length) {
        //console.log(this.name + ": moveTo got path from " + this.pos.getKey(1) + " to " + targetKey + "; ops=" + pf.ops + "; cost=" + pf.cost + "; length=" + pf.path.length);
        travel.setPath(memory.travel, pf.serialized ? pf.path : travel.serializePath(pf.path), sourceKey, targetKey, addCreeps || pf.incomplete ? null : this.room.memory.pathCache, pf.incomplete);
        return this.move(this.pos.getDirectionTo(travel.getPosFromSerializedPath(memory.travel.path,memory.travel.iter)));
    } else if (!pf.incomplete) {
        memory.travel.near = this.pos.getKey(1);
        memory.travel.here = 0;
        return this.move(this.pos.getDirectionTo(targetPos));
    }

    return ERR_NO_PATH;
}

let origMoveTo = Creep.prototype.moveTo;
Creep.prototype.moveTo = function() {
    let targetPos, opts;
    [targetPos, opts] = this.moveToPos(arguments[0], arguments[1], arguments[2]);
    let res = this.travelTo(targetPos, opts);
    if (res == OK)
        this.room.needRoad(this);
    return res;
}

Creep.prototype.goFromKeepers = function() {
    let targetPos = this.room.getNearKeeperPos(this.pos, 5) || this.room.getNearComingLairPos(this.pos, 5);
    if (!targetPos)
        return -7;
    let safePlace = this.pos.findClosestByPath(utils.getRangedPlaces(this, targetPos, 6));
    return this.moveTo(safePlace ? safePlace : Game.spawns[this.memory.spawnName].room.controller); 
}

Creep.prototype.attackNearHostile = function(range) {
    if (!this.getActiveBodyparts(ATTACK))
        return ERR_NO_BODYPART;

    let targets = this.room.getNearAttackers(this.pos, range || 5);
    if (!targets.length)
        return ERR_NOT_FOUND;
        
    let target = Game.getObjectById(targets[0].id);
    if (!target)
        return ERR_INVALID_TARGET;

    console.log(this.name + ": attackNearHostile, pos=" + this.pos.getKey(1) + ", hits=" + target.hits + ", owner=" + target.owner.username);

    if (this.attack(target) == ERR_NOT_IN_RANGE)
        this.moveTo(target);
    return OK;
}

Creep.prototype.findSourceAndGo = function () {
    if (this.room.memory.type == 'lair' && !this.goFromKeepers())
        return;
        
    if (!this.memory.energyID || Game.time - (this.memory.energyTime || 0) > ENERGY_TIMEOUT) {
        if (this.findSource() == OK)
            this.memory.energyTime = Game.time;
    }
    if (this.memory.energyID) {
        this.gotoSource();
    } else if (Memory.rooms[this.memory.roomName] && Memory.rooms[this.memory.roomName].pointPos) {
        let pos = Memory.rooms[this.memory.roomName].pointPos;
        this.moveTo(new RoomPosition(pos.x, pos.y, pos.roomName));
    }
}

Creep.prototype.findSource = function () {
    let memory = Memory.rooms[this.memory.roomName];
    if (!memory) {
        console.log(this.name + ": findSource have no memory of " + this.memory.roomName);
        return -1;
    }

    let targets = _.filter(
        (memory.structures[STRUCTURE_CONTAINER] || []).concat( 
        (memory.structures[STRUCTURE_STORAGE] || []), 
        (memory.structures[STRUCTURE_SOURCE] || []),
        (memory.resources || []) ),
     t => t.energy);

    if (!targets.length) {
        this.memory.energyID = null;
        return -1;
    }

    let energyNeed = this.carryCapacity - _.sum(this.carry);
    let resultTarget;
    let minCost;
    for(let target of targets) {
        let placesLeft = target.places - (global.cache.wantEnergy[target.id] ? global.cache.wantEnergy[target.id].creepsCount : 0);
        if (placesLeft <= 0)
            continue;
        let range = this.pos.getRangeTo(target.pos.x, target.pos.y);
        let energyLeft = target.energy - (global.cache.wantEnergy[target.id] ? global.cache.wantEnergy[target.id].energy : 0);

        let cpriority = 0;
        if (target.resourceType) { // Dropped
            energyLeft -= range * 1.2;
            if (this.room.memory.invadersCount || energyLeft <= 0)
                continue;
            else
                cpriority = 2;
        } else if (target.structureType == STRUCTURE_CONTAINER && energyNeed <= energyLeft) {
            cpriority = 2;
        } else if (target.structureType == STRUCTURE_SOURCE) { // Source
            if (target.minersFrom)
                continue;
            else if (this.getActiveBodyparts(WORK) <= 1)
                cpriority = -2;
        }

        let energyTicks = (energyNeed - energyLeft) / 10;
        if (energyTicks < 0)
            energyTicks = 0;

        let cost = range * 1.2 + energyTicks - 100 * cpriority;
        if (minCost === undefined || cost < minCost) {
            resultTarget = target;
            minCost = cost;
        }
        //if (this.room.name == "W46N4")
        //   console.log(this.name + " [" + this.room.name + "]: targetID=" + target.id + ", range=" + range + ", energyTicks=" + energyTicks + ", energyLeft=" + energyLeft + ", cpriotiy=" + cpriority + ", energyNeed=" + energyNeed + ", cost=" + cost + ", result=" + (resultTarget ? resultTarget.id : 0));
    }
    if (!resultTarget) {
        this.memory.energyID = null;
        return -2;
    }

    global.cache.wantEnergy[resultTarget.id] = global.cache.wantEnergy[resultTarget.id] || {energy : 0, creepsCount : 0};
    global.cache.wantEnergy[resultTarget.id].energy += energyNeed;
    global.cache.wantEnergy[resultTarget.id].creepsCount++;
    
    this.memory.energyObj = resultTarget;
    this.memory.energyID = resultTarget.id;
    return 0;
}
    
Creep.prototype.gotoSource = function() {
    let source = Game.getObjectById(this.memory.energyID);
    if(!source) {
        //console.log(this.name + " [" + this.room.name + "] can't get source with enegryID=" + this.memory.energyID);
        this.memory.energyObj.energy = 0;
        this.memory.energyID = null;
        return ERR_INVALID_TARGET;
    }

    if (this.room.name != source.pos.roomName) {
        this.memory.energyTime = Game.time;
        return this.moveTo(source);
    }

    if (this.memory.energyObj.buildContainerID) {
        let container = Game.getObjectById(this.memory.energyObj.buildContainerID);
        if (container && this.pos.isEqualTo(container.pos) && this.carry.energy >= this.getActiveBodyparts(WORK) * BUILD_POWER) {
            let res = this.build(container);
            //console.log(this.name + ": built container, energy=" + this.carry.energy + ", res=" + res);
            return res;
        }
    }
    
    let res;
    if(source.structureType && (source.structureType == STRUCTURE_CONTAINER || source.structureType == STRUCTURE_STORAGE || source.structureType == STRUCTURE_LINK)) {
        res = this.withdraw(source, RESOURCE_ENERGY);
    } else if (source.resourceType && source.resourceType == RESOURCE_ENERGY) {
        res = this.pickup(source);
        if (!res) {
            this.memory.energyID = null;
            return ERR_INVALID_TARGET;
        }
    } else {
        res = this.harvest(source);
    }
    
    if (res == OK) {
        this.memory.energyTime = Game.time;
    } else if (res == ERR_NOT_IN_RANGE) {
        return this.moveTo(source);
    } else if (res == ERR_NOT_ENOUGH_ENERGY) {
        ;
    } else if (res < 0) {
        console.log(this.name + " tried to get energy from " + this.memory.energyID + " with res = " + res);
        this.memory.energyID = null;
    }

    return res;
}

Creep.prototype.checkInRoomAndGo = function () {
    if (this.room.name == this.memory.roomName)
        return 0;
    
    if (!Memory.rooms[this.memory.roomName] || !Memory.rooms[this.memory.roomName].pointPos) {
        console.log(this.name + ": no pointPos for " + this.memory.roomName);
        return -1;
    }

    this.moveTo(Memory.rooms[this.memory.roomName].pointPos);

    return 1;
}