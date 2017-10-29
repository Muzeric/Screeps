var travel = require('travel');

Creep.prototype.getUnboostedBodyparts = function (type) {
    return _.filter( this.body, p => p.type == type && p.hits && !p.boost ).length;
}

Creep.prototype.getBoostedBodyparts = function (type) {
    return _.filter( this.body, p => (!type || p.type == type) && p.boost ).length;
}

// harvest: 0, create: 0, build: 0, repair: 0, upgrade: 0, pickup
let origHarvest = Creep.prototype.harvest;
Creep.prototype.harvest = function () {
    let res = origHarvest.apply(this, arguments);
    if (res == OK && arguments[0] instanceof Source) {
        let can = this.getActiveBodyparts(WORK) * 2;
        let was = arguments[0].energy;

        global.cache.stat.updateRoom(this.room.name, 'harvest', _.min([can, was]));
        global.cache.stat.updateRole(this.memory.role, 'harvest', _.min([can, was]));
        if (arguments[0].ticksToRegeneration == 1) {
            global.cache.stat.updateRoom(this.room.name, 'lost', -1 * _.min([can, was]));
            global.cache.stat.updateRole(this.memory.role, 'lost', -1 * _.min([can, was]));
        }
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
        global.cache.stat.updateRole(this.memory.role, 'pickup', _.min([can, was]));
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
        global.cache.stat.updateRole(this.memory.role, 'build', -1 * _.min([can, got, was]));
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
        global.cache.stat.updateRole(this.memory.role, 'repair', -1 * _.min([can, got, was]));
    }
    return res;
}

let origUpgrade = Creep.prototype.upgradeController;
Creep.prototype.upgradeController = function () {
    let res = origUpgrade.apply(this, arguments);
    if (res == OK && arguments[0] instanceof StructureController) {
        let sum = 0;
        let est = this.carry.energy;
        for (let part of _.filter(this.body, p => p.type == WORK && p.hits)) {
            if (est <= 0)
                break;
            if (part.boost && part.boost in BOOSTS["work"] && "upgradeController" in BOOSTS["work"][part.boost])
                sum += BOOSTS["work"][part.boost]["upgradeController"];
            else
                sum++;
            est--;
        }
        
        global.cache.stat.updateRoom(this.room.name, 'upgrade', -1 * sum);
        global.cache.stat.updateRole(this.memory.role, 'upgrade', -1 * sum);
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
        if (a instanceof RoomPosition) {
            b.withCreeps = 0;
            return [a, b];
        } else if (a.pos && a.pos instanceof RoomPosition) {
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

    let pf = travel.getPath(this.pos, subpath, null, 1, this.room.memory.pathCache, 300, opts.ignoreHostiled);
    if (pf.incomplete) {
        //console.log(this.name + ": moveTo incomplete sub path from " + this.pos.getKey(1) + " to " + JSON.stringify(subpath) + "; ops=" + pf.ops + "; cost=" + pf.cost + "; length=" + pf.path.length);
        console.log(this.name + ": moveTo incomplete sub path from " + this.pos.getKey(1) + "; ops=" + pf.ops + "; cost=" + pf.cost + "; length=" + pf.path.length);
        return this.move(Math.floor(Math.random() * 8) + 1);
        //return ERR_NO_PATH;
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

    let iter = travel.getIterFromSerializedPath(mem.path, this.pos, global.cache.utils.clamp(mem.iter-1, 0, mem.iter));
    if (iter !== null && iter >= mem.iter) {
        mem.iter = iter+1;
        mem.here = 0;
    } else if (iter === null && (mem.iter || this.pos.getKey() != mem.sourceKey)) { // Zero mem.iter may be means we are on the source pos and it's ok
        let border_iter = travel.getIterFromSerializedPath(mem.path, this.pos.invertBorderPos(), global.cache.utils.clamp(mem.iter-1, 0, mem.iter));
        if (border_iter !== null) {
            //console.log(this.name + ": moveTo BUT got inverted pos, iter=" + border_iter + "; travel=" + JSON.stringify(this.memory.travel));
            return OK;
        } else {
            let pos = travel.getPosFromSerializedPath(mem.path, mem.iter);
            let key = pos ? pos.getKey(1) : 'uknown';
            //console.log(this.name + ": moveTo " + memkey + " (time=" + Game.time + ") mem.iter=" + mem.iter + " (" + key + "), iter="+ iter + " (" + this.pos.getKey(1) + "); travel=" + JSON.stringify(this.memory.travel));
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
        //if (this.pos.isBorder())
        //    console.log(this.name + ": moveTo (" + targetPos.getKey(1) + ") " + memkey + " too much here iter=" + mem.iter + ", here=" + mem.here + ", pos=" + this.pos.getKey(1));
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
    if (targetPos.roomName == this.pos.roomName) {
        if (this.pos.getRangeTo(targetPos) < 6) {
            maxOps = PATH_OPS_LIMIT_SHORT;
            addCreeps = 1;
        } else {
            maxOps = PATH_OPS_LIMIT_ROOM;
        }
    }
    if (opts.withCreeps)
        addCreeps = 1;
    
    let range = 1;
    if (opts.range !== undefined)
        range = opts.range;

    let pf = travel.getPath(this.pos, {pos: targetPos, range: range}, targetKey, addCreeps, this.room.memory.pathCache, maxOps, opts.ignoreHostiled);
    if (pf.incomplete) {
        console.log(this.name + ": moveTo incomplete path from " + this.pos.getKey(1) + " to " + targetKey + "; ops=" + pf.ops + "; cost=" + pf.cost + "; length=" + pf.path.length + "; addCreeps=" + addCreeps);
        if (addCreeps) {
            pf = travel.getPath(this.pos, {pos: targetPos, range: range}, targetKey, 0, this.room.memory.pathCache, maxOps, opts.ignoreHostiled);
            if (pf.incomplete)
                console.log(this.name + ": moveTo incomplete path from " + this.pos.getKey(1) + " to " + targetKey + "; ops=" + pf.ops + "; cost=" + pf.cost + "; length=" + pf.path.length + "; addCreeps=" + addCreeps);
        }
        
    }

    if (pf.path.length) {
        //console.log(this.name + ": moveTo got path from " + this.pos.getKey(1) + " to " + targetKey + "; ops=" + pf.ops + "; cost=" + pf.cost + "; length=" + pf.path.length);
        travel.setPath(memory.travel, pf.serialized ? pf.path : travel.serializePath(pf.path), sourceKey, targetKey, (addCreeps || pf.incomplete) ? null : this.room.memory.pathCache, pf.incomplete);
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

let origMove = Creep.prototype.move;
Creep.prototype.move = function() {
    let res = origMove.apply(this, arguments);
    if (res == OK) {
        this.memory.newPosTime = Game.time;
        this.memory.newPosDir = arguments[0];
        this.memory.newPos = this.pos.move(arguments[0]);
    }
    return res;
}


Creep.prototype.goFromKeepers = function() {
    let targetPos = this.room.getNearKeeperPos(this.pos, 5) || this.room.getNearComingLairPos(this.pos, 5);
    if (!targetPos)
        return -7;
    let safePlace = this.pos.findClosestByPath(global.cache.utils.getRangedPlaces(this, targetPos, 6));
    return this.moveTo(safePlace ? safePlace : Game.spawns[this.memory.spawnName].room.controller); 
}

Creep.prototype.attackNearHostile = function(range, mark) {
    if (!this.getActiveBodyparts(ATTACK) && !this.getActiveBodyparts(RANGED_ATTACK))
        return ERR_NO_BODYPART;

    let targets = this.room.getNearAttackers(this.pos, range || 5);
    if (!targets.length)
        return ERR_NOT_FOUND;

    let minRange;
    let minTarget;
    let mass = 0;
    for (let t of targets) {
        let range = this.pos.getRangeTo(t.pos);
        if (minRange === undefined || range < minRange) {
            minRange = range;
            minTarget = t;
        }
        mass += range == 1 ? 10 : (range == 2 ? 4 : (range == 3 ? 1 : 0));
    }
    
    let target = Game.getObjectById(minTarget.id);
    if (!target)
        return ERR_INVALID_TARGET;

    console.log(this.name + ": attackNearHostile, pos=" + this.pos.getKey(1) + ", hits=" + target.hits + ", owner=" + target.owner.username);

    if (this.getActiveBodyparts(RANGED_ATTACK)) {
        console.log(this.name + ": mass=" + mass);
        if (mass > 10)
            this.rangedMassAttack();
        else
            this.rangedAttack(target);
    }
        
    let res = this.attack(target);
    if (res == ERR_NOT_IN_RANGE)
        this.moveTo(target);
    else if (res == OK && mark)
        mark.attacked = 1;
    
    return OK;
}

Creep.prototype.findSourceAndGo = function (exceptStorage) {
    if (this.room.memory.type == 'lair' && !this.goFromKeepers())
        return;
        
    if (Game.time - (this.memory.energyTime || 0) > ENERGY_TIMEOUT) {
        this.memory.energyID = null;
        this.memory.bookedEnergyID = null;
    }

    if (
        (this.room.name == this.memory.roomName && !this.memory.energyID) ||
        (this.room.name != this.memory.roomName && !this.memory.energyID && !this.memory.bookedEnergyID)
    ) {
        this.findSource();
    }

    this.gotoSource(exceptStorage);
}

Creep.prototype.findSource = function () {
    let memory = Memory.rooms[this.memory.roomName];
    if (!memory) {
        console.log(this.name + ": findSource have no memory of " + this.memory.roomName);
        return ERR_NOT_IN_RANGE;
    }

    let booking = (this.room.name != this.memory.roomName);

    let targets = _.filter(
        (memory.structures[STRUCTURE_CONTAINER] || []).concat( 
        (memory.structures[STRUCTURE_STORAGE] || []), 
        (memory.structures[STRUCTURE_SOURCE] || []),
        (memory.resources || []) ),
     t => t.energy);

    if (!targets.length) {
        this.memory.energyID = null;
        return ERR_NOT_FOUND;
    }

    let energyNeed = this.carryCapacity - _.sum(this.carry);
    let resultTarget;
    let minCost;
    let resultEnergyLeft;
    for(let target of targets) {
        let placesLeft = target.places - (global.cache.wantEnergy[target.id] ? global.cache.wantEnergy[target.id].creepsCount : 0);
        if (placesLeft <= 0 && !booking)
            continue;
        let range = this.pos.getRangeTo(target.pos.x, target.pos.y);
        let energyLeft = target.energy - (global.cache.wantEnergy[target.id] ? global.cache.wantEnergy[target.id].energy : 0);

        let cpriority = 0;
        if (target.resourceType) { // Dropped
            energyLeft -= range * 1.2;
            if (this.room.memory.hostilesCount || energyLeft <= 0)
                continue;
            else
                cpriority = 2;
        } else if (energyLeft > 0 && "my" in target && !target.my) {
            cpriority = 2;
        } else if (target.structureType == STRUCTURE_CONTAINER) {
                if (target.controllered && this.memory.role != "upgrader")
                    continue;
                else if (target.controllered && this.memory.role == "upgrader" && energyNeed <= energyLeft)
                    cpriority = 10;
                else if (energyNeed <= energyLeft)
                    cpriority = 2;
                else if (!target.minersTo)
                    continue;
        } else if (target.structureType == STRUCTURE_SOURCE) { // Source
            if (target.minersFrom)
                continue;
            else if (this.getActiveBodyparts(WORK) <= 1)
                cpriority = -2;
            else
                cpriority = -1;
        }

        let energyTicks = (energyNeed - energyLeft) / 10;
        if (energyTicks < 0)
            energyTicks = 0;

        let cost = range * 1.2 + energyTicks - 100 * cpriority;
        if (minCost === undefined || cost < minCost || (cost == minCost && energyLeft > resultEnergyLeft)) {
            resultTarget = target;
            minCost = cost;
            resultEnergyLeft = energyLeft;
        }
        //if (this.room.name == "W46N4")
        //   console.log(this.name + " [" + this.room.name + "]: targetID=" + target.id + ", range=" + range + ", energyTicks=" + energyTicks + ", energyLeft=" + energyLeft + ", cpriotiy=" + cpriority + ", energyNeed=" + energyNeed + ", cost=" + cost + ", result=" + (resultTarget ? resultTarget.id : 0));
    }
    if (!resultTarget) {
        this.memory.energyID = null;
        this.memory.bookedEnergyID = null;
        return ERR_NOT_FOUND;
    }

    this.memory.energyTime = Game.time;
    this.memory.energyObj = resultTarget;

    if (booking) {
        this.memory.bookedEnergyID = resultTarget.id;
        this.memory.energyID = null;
        return OK;
    }

    global.cache.wantEnergy[resultTarget.id] = global.cache.wantEnergy[resultTarget.id] || {energy : 0, creepsCount : 0};
    global.cache.wantEnergy[resultTarget.id].energy += energyNeed;
    global.cache.wantEnergy[resultTarget.id].creepsCount++;
    
    this.memory.energyID = resultTarget.id;
    this.memory.bookedEnergyID = null;
    return OK;
}
    
Creep.prototype.gotoSource = function(exceptStorage) {
    let source;
    if (!this.memory.energyID && !this.memory.bookedEnergyID) {
        if (this.room.name == this.memory.roomName && !this.pos.isBorder())
            return OK;
        if (Memory.rooms[this.memory.roomName] && Memory.rooms[this.memory.roomName].pointPos) {
            let pos = Memory.rooms[this.memory.roomName].pointPos;
            return this.moveTo(new RoomPosition(pos.x, pos.y, pos.roomName));
        } else {
            console.log(this.name + ": gotoSource no targets and no pointPos in room=" + this.memory.roomName);
            return ERR_NOT_FOUND;
        }
    } else if (this.memory.energyID) {
        source = Game.getObjectById(this.memory.energyID);
    } else {
        source = Game.getObjectById(this.memory.bookedEnergyID);
    }
    
    if(!source) {
        //console.log(this.name + " [" + this.room.name + "] can't get source with enegryID=" + this.memory.energyID);
        this.memory.energyObj.energy = 0;
        this.memory.energyID = null;
        this.memory.bookedEnergyID = null;
        return ERR_INVALID_TARGET;
    }

    if (this.room.name != source.pos.roomName || !this.memory.energyID) {
        this.memory.energyTime = Game.time;
        return this.moveTo(source);
    }

    if (this.memory.energyObj.buildContainerID && this.room.canBuildContainers()) {
        let container = Game.getObjectById(this.memory.energyObj.buildContainerID);
        if (container && container.pos.roomName == this.room.name && this.pos.getRangeTo(container.pos) <= 3 && this.carry.energy >= this.getActiveBodyparts(WORK) * BUILD_POWER) {
            let res = this.build(container);
            //console.log(this.name + ": built container, energy=" + this.carry.energy + ", res=" + res);
            return res;
        }
    }
    
    let res;
    if (source.resourceType && source.resourceType == RESOURCE_ENERGY) {
        res = this.pickup(source);
        if (!res) {
            this.memory.energyID = null;
            return ERR_INVALID_TARGET;
        }
    } else if ("ticksToRegeneration" in source) {
        res = this.harvest(source);
    } else  {
        if (_.sum(this.carry) != this.carry.energy && source.structureType == STRUCTURE_STORAGE) {
            res = this.transfer(source, _.filter(_.keys(this.carry), t => t != "energy")[0]);
        } else {
            if (exceptStorage && source.structureType == STRUCTURE_STORAGE)
                res = this.pos.isNearTo(source) ? OK : ERR_NOT_IN_RANGE;
            else
                res = this.withdraw(source, RESOURCE_ENERGY);
        }
    }
    
    if (res == OK) {
        this.memory.energyTime = Game.time;
    } else if (res == ERR_NOT_IN_RANGE) {
        return this.moveTo(source);
    } else if (res == ERR_NOT_ENOUGH_ENERGY) {
        if ([STRUCTURE_EXTENSION, STRUCTURE_CONTAINER].indexOf(source.structureType) !== -1)
            this.memory.energyID = null;
    } else if (res < 0) {
        console.log(this.name + " tried to get energy from " + this.memory.energyID + " with res = " + res);
        this.memory.energyID = null;
    }

    return res;
}

Creep.prototype.checkInRoomAndGo = function (opts) {
    if (this.room.name == this.memory.roomName)
        return OK;
    
    if (!Memory.rooms[this.memory.roomName] || !Memory.rooms[this.memory.roomName].pointPos) {
        console.log(this.name + ": no pointPos for " + this.memory.roomName);
        return ERR_NOT_FOUND;
    }

    this.moveTo(new RoomPosition(Memory.rooms[this.memory.roomName].pointPos.x, Memory.rooms[this.memory.roomName].pointPos.y, Memory.rooms[this.memory.roomName].pointPos.roomName), opts);

    return ERR_NOT_IN_RANGE;
}

Creep.prototype.boost = function (bodyPart, skill, skipTimer) {
    let bt = global.cache.minerals.getBoostResource(bodyPart, skill);
    if (!bt)
        return ERR_INVALID_ARGS;

    if (    this.ticksToLive < BOOST_STOP_TICKS 
            && !skipTimer
        || (
            this.ticksToLive < BOOST_MIN_TICKS
            && !skipTimer
            && !(bt in this.carry)
            && (!("boostBook" in this.memory) || !(bt in this.memory.boostBook))
            && !("boostGot" in this.memory))
        )
        return ERR_GCL_NOT_ENOUGH;

    let unboostedCount = this.getUnboostedBodyparts(bodyPart);
    if (!unboostedCount) {
        if ("boostGot" in this.memory) {
            let lab = Game.getObjectById(this.memory.boostGot.labID);
            if (lab && this.pos.isNearTo(lab)) {
                let res = this.transfer(lab, this.memory.boostGot.mineralType, this.memory.boostGot.mineralAmount);
                delete this.memory.boostGot;
                console.log(this.room.name + ". " + this.name + ": BOOSTing, return another resource to lab (" + res + ")");
            }
        }
        return ERR_FULL;
    }

    let room = this.room;
    let labs = room.getBoostLabs();
    if (!labs.length) {
        room = Game.spawns[this.memory.spawnName].room;
        if (!room)
            return ERR_NOT_ENOUGH_EXTENSIONS;
        labs = room.getBoostLabs();
        if (!labs.length)
            return ERR_NOT_ENOUGH_EXTENSIONS;
    }

    let storage = room.storage;
    if (!storage)
        return ERR_NOT_ENOUGH_EXTENSIONS;

    let need = LAB_BOOST_MINERAL * unboostedCount;
    let got = this.carry[bt] || 0;
    let booked = "boostBook" in this.memory ? (this.memory.boostBook[bt] || 0) : 0;
    let free = this.carryCapacity - _.sum(this.carry);
    let able = storage.store[bt] || 0;
    let ableWR = global.cache.queueTransport.getStoreWithReserved(storage, bt);
    
    let lab = Game.getObjectById(labs[0].id);
    if (!lab)
        return ERR_INVALID_ARGS;
    if (lab.energy < LAB_BOOST_ENERGY)
        return ERR_NOT_ENOUGH_RESOURCES;
    let gotLab = lab.mineralType == bt ? (lab.mineralAmount || 0) : 0;

    if (got < need && got + free < need && _.sum(this.carry) != got) {
        return ERR_FULL;
    } else if (gotLab >= LAB_BOOST_MINERAL && this.pos.isNearTo(lab)) {
        let res = lab.boostCreep(this);
        console.log(this.room.name + ". " + this.name + ": BOOSTED (" + res + ")");
        if (booked)
            delete this.memory.boostBook[bt];
    } else if (got >= LAB_BOOST_MINERAL && (got >= need || free < LAB_BOOST_MINERAL || able < LAB_BOOST_MINERAL)) {
        if (lab.mineralType && lab.mineralType != bt && lab.mineralAmount > 0 && free >= lab.mineralAmount && this.pos.isNearTo(lab)) {
            let res = this.withdraw(lab, lab.mineralType, lab.mineralAmount);
            console.log(this.room.name + ". " + this.name + ": BOOSTing, got another resource from lab (" + res + ")");
            if (res == OK)
                this.memory.boostGot = {labID: lab.id, mineralType: lab.mineralType, mineralAmount: lab.mineralAmount};
        } else {
            if (this.transfer(lab, bt) == ERR_NOT_IN_RANGE)
                this.moveTo(lab);
        }
        if (Game.time % 5 == 0)
            console.log(this.room.name + ". " + this.name + ": BOOSTing, transfer");
    } else if (this.carryCapacity == 0 && booked >= LAB_BOOST_MINERAL && gotLab >= LAB_BOOST_MINERAL) {
        this.moveTo(lab);
        if (Game.time % 5 == 0)
            console.log(this.room.name + ". " + this.name + ": BOOSTing, move to lab");
    } else if (able >= LAB_BOOST_MINERAL && free >= LAB_BOOST_MINERAL) {
        if (this.withdraw(storage, bt, _.floor( _.min([need - got, free, able]) / LAB_BOOST_MINERAL) * LAB_BOOST_MINERAL ) == ERR_NOT_IN_RANGE)
            this.moveTo(storage);
        if (Game.time % 5 == 0)
            console.log(this.room.name + ". " + this.name + ": BOOSTing, withdraw");
    } else if (this.carryCapacity == 0 && (able >= LAB_BOOST_MINERAL && ableWR >= LAB_BOOST_MINERAL || booked >= LAB_BOOST_MINERAL)) {
        let futureGotLab = global.cache.queueTransport.getStoreWithReserved(lab, bt);
        if (booked && futureGotLab >= LAB_BOOST_MINERAL) {
            this.moveTo(lab, {range: 5});
            if (Game.time % 5 == 0)
                console.log(this.room.name + ". " + this.name + ": BOOSTing, wait resource");
        } else if (!booked && ableWR > 0) {
            let amount = _.min([need, able, ableWR]);
            global.cache.queueTransport.addRequest(storage, lab, bt, amount);
            this.memory.boostBook = this.memory.boostBook || {};
            this.memory.boostBook[bt] = amount;
        } else {
            return ERR_NOT_ENOUGH_RESOURCES;
        }
    } else {
        //console.log(this.name + ": BOOSTing, no resources");
        return ERR_NOT_ENOUGH_RESOURCES;
    }

    global.cache.boostingLabs[lab.id] = global.cache.boostingLabs[lab.id] || {};
    global.cache.boostingLabs[lab.id][bt] = 1;

    return OK;
}