var utils = require('utils');

Creep.prototype.moveToPos = function (a, b) {
    if (_.isNumber(a) && _.isNumber(b)) {
        return new RoomPosition(a, b, this.room.name);
    } else if (_.isObject(a)) {
        if (a instanceof global.RoomPosition)
            return a;
        else if (a.pos && a.pos instanceof global.RoomPosition)
            return a.pos;
    }
    return null;
}

RoomPosition.prototype.getKey = function(long) {
    return this.x + "x" + this.y + (long ? this.roomName : '');
}

Creep.prototype.serializePath = function(path) {
    let ret = '';
    let curRoomName;
    for (let p of path) {
        if (curRoomName === undefined || curRoomName != p.roomName) {
            curRoomName = p.roomName;
            ret += String.fromCharCode(33) + curRoomName + String.fromCharCode(33);
        }
        ret += String.fromCharCode(p.x * 50 + p.y + 34);
    }

    return ret;
}

Creep.prototype.getPosFromSerializedPath = function (path, index) {
    let curRoomName;
    let curIndex = 0;
    for (let i = 0; i < path.length; i++) {
        let code = path.charCodeAt(i);
        if (code == 33) {
            let end = path.indexOf(String.fromCharCode(33), i+1);
            curRoomName = path.substring(i+1, end);
            i = end;
        } else {
            if (curIndex == index) {
                code -= 34;
                let x = _.floor(code / 50);
                let y = code - x * 50;
                return new RoomPosition(x, y, curRoomName);
            }
            curIndex++;
        }
    }

    return null;
}

let origMoveTo = Creep.prototype.moveTo;
Creep.prototype.moveTo = function() {
    let memory = this.memory;
    let res;
    if (memory.role == "scout") {
        if (this.fatigue > 0)
            return ERR_TIRED;
        let targetPos = this.moveToPos(arguments[0], arguments[1]);
        let targetKey = targetPos.getKey(1);
        console.log(this.name + ": moveTo targetKey=" + targetKey);
        if (this.pos.isEqualTo(targetPos)) {
                memory.travel = null;
                res = OK;
        } else if (memory.travel && memory.travel.targetKey == targetKey) {
            console.log(this.name + ": moveTo use travel, iter=" + memory.travel.iter);
            if (memory.travel.iter < memory.travel.length && this.pos.isEqualTo(this.getPosFromSerializedPath(memory.travel.path,memory.travel.iter))) {
                memory.travel.iter++;
                memory.travel.here = 0;
            }

            if (memory.travel.iter >= memory.travel.length) {
                res = this.move(this.pos.getDirectionTo(targetPos));
            } else {
                if (memory.travel.here > PATH_TIMEOUT) {
                    console.log(creep.name + ": moveTo too much here");
                    memory.travel = null;
                    res = origMoveTo.apply(this, arguments);
                } else {
                    res = this.move(this.pos.getDirectionTo(this.getPosFromSerializedPath(memory.travel.path,memory.travel.iter)));
                    if (res == OK)
                        memory.travel.here++;
                }
            }
        } else if (targetPos.roomName == this.room.name && this.pos.getRangeTo(targetPos) < 6) {
            console.log(creep.name + ": moveTo short distance");
            res = origMoveTo.apply(this, arguments);
        } else {
            memory.travel = {};
            let pathCache = this.room.memory.pathCache;
            let sourceKey = this.pos.getKey();
            if (pathCache[targetKey] && pathCache[targetKey][sourceKey]) {
                console.log(this.name + ": moveTo use path from cache");
                memory.travel.path = pathCache[targetKey][sourceKey].path;
                memory.travel.iter = 0;
                memory.travel.here = 0;
                memory.travel.targetKey = targetKey;
                res = this.move(this.pos.getDirectionTo(this.getPosFromSerializedPath(memory.travel.path,memory.travel.iter)));
            /*
            } else if (pathCache[targetKey]) {
                let sourcePoses = [];
                for (let key in pathCache[targetKey]) {
                    let poses = this.pos.findInRange(_.filter(pathCache[targetKey][key].path, p => p.roomName == this.room.name), 3);
                    if (poses.length) {
                        sourcePoses.concat(poses);
                    }
                }
                if (sourcePoses.length) {
                    let pf = PathFinder.search(
                        this.pos,
                        sourcePoses,
                        {
                            plainCost: 2,
                            swampCost: 10,
                            roomCallback: function(roomName) { 
                                if (!(roomName in Memory.rooms) || Memory.rooms[roomName].type == 'hostiled' || !(costMatrix in Memory.rooms[roomName]))
                                    return false;
                                return PathFinder.CostMatrix.deserialize(Memory.rooms[roomName].costMatrix); 
                            },
                        }
                    );

                }
            */
            }

            if (!memory.travel.path) {
                let pf = PathFinder.search(
                    this.pos,
                    {pos: targetPos, range: 1},
                    {
                        plainCost: 2,
                        swampCost: 10,
                        roomCallback: function(roomName) { 
                            if (!(roomName in Memory.rooms) || Memory.rooms[roomName].type == 'hostiled' || !("costMatrix" in Memory.rooms[roomName]))
                                return false;
                            return PathFinder.CostMatrix.deserialize(Memory.rooms[roomName].costMatrix); 
                        },
                    }
                );
                if (pf.incomplete) {
                    console.log(this.name + ": moveTo incomplete path to " + targetKey + "; ops=" + pf.ops + "; cost=" + pf.cost + "; length=" + pf.path.length);
                    res = ERR_NO_PATH; //origMoveTo.apply(this, arguments);
                } else {
                    console.log(this.name + ": moveTo got path to " + targetKey + "; ops=" + pf.ops + "; cost=" + pf.cost + "; length=" + pf.path.length);
                    memory.travel.path = this.serializePath(pf.path);
                    memory.travel.length = pf.path.length;
                    memory.travel.iter = 0;
                    memory.travel.here = 0;
                    memory.travel.targetKey = targetKey;
                    pathCache[targetKey] = pathCache[targetKey] || {};
                    pathCache[targetKey][sourceKey] = {path: memory.travel.path, useTime: Game.time};

                    res = this.move(this.pos.getDirectionTo(pf.path[0]));
                }
            }
        }
    } else {
        res = origMoveTo.apply(this, arguments);
    }

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
    if (!this.getActiveBodyparts(ATTACK))
        return -1;

    let target = this.room.getNearHostile(this.pos, range || 5);
    if (!target)
        return -7;
        
    target = Game.getObjectById(target.id);
    if (this.attack(target) == ERR_NOT_IN_RANGE)
        this.moveTo(target);
    return 0;
}

Creep.prototype.findSourceAndGo = function () {
    if (this.room.memory.type == 'lair' && !this.goFromKeepers())
        return;
        
    if (!this.memory.energyID || Game.time - (this.memory.energyTime || 0) > ENERGY_TIMEOUT) {
        if (this.findSource() == OK)
            this.memory.energyTime = Game.time;
    }
    if (this.memory.energyID)
        this.gotoSource();
}

Creep.prototype.findSource = function () {    
    let memory =this.room.memory;
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
        let placesLeft = target.places - (Memory.energyWanted[target.id] ? Memory.energyWanted[target.id].creepsCount : 0);
        if (placesLeft <= 0)
            continue;
        let range = this.pos.getRangeTo(target.pos.x, target.pos.y);
        let energyLeft = target.energy - (Memory.energyWanted[target.id] ? Memory.energyWanted[target.id].energy : 0);

        let cpriority = 0;
        if (target.resourceType) { // Dropped
            energyLeft -= range * 1.2;
            if (this.room.memory.hostilesCount || energyLeft <= 0)
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

    Memory.energyWanted[resultTarget.id] = Memory.energyWanted[resultTarget.id] || {energy : 0, creepsCount : 0};
    Memory.energyWanted[resultTarget.id].energy += energyNeed;
    Memory.energyWanted[resultTarget.id].creepsCount++;
    
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
        return;
    }
    
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
    
    if (res == OK) {
        this.memory.energyTime = Game.time;
    } else if (res == ERR_NOT_IN_RANGE) {
        this.moveTo(source, { visualizePathStyle : {lineStyle: "dotted", stroke : 'green' , opacity : 0.5}, costCallback : function(name, cm) { cm.set(4, 43, 255); cm.set(4, 42, 255); cm.set(4, 41, 255); } });
    } else if (res == ERR_NOT_ENOUGH_ENERGY) {
        return;
    } else if (res < 0) {
        console.log(this.name + " tried to get energy from " + this.memory.energyID + " with res = " + res);
        this.memory.energyID = null;
    }
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

Creep.prototype.setContainerRoomName = function () {
    let minCost;

    let creep = this;
    _.filter(Game.rooms, r => r.memory.type == "my" && r.memory.pointPos && Game.map.getRoomLinearDistance(r.name, creep.memory.roomName) <= 3).forEach( function(r) {
        let carryParts = _.sum( _.map( _.filter(Game.creeps, c => c.memory.role == "longharvester" && c.memory.containerRoomName == r.name), c => _.sum(c.body, p => p.type == CARRY) ) );
        let cost = carryParts / r.energyCapacityAvailable;
        if (minCost === undefined || cost < minCost) {
            creep.memory.containerRoomName = r.name;
            minCost = cost;
        }
    });

    if (!this.memory.containerRoomName)
        console.log(this.name + ": can't set container room name");
    
    //console.log(this.name + ": set containerRoomName=" + this.memory.containerRoomName);
}