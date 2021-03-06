require('constants');
require('prototype.creep');
require('prototype.roomposition');
require('prototype.structure');
var travel = require('travel');
//const profiler = require('screeps-profiler');
// This line monkey patches the global prototypes. 
// profiler.enable();

module.exports.loop = function () {
//profiler.wrap(function() {
    Game.roomsHelper = require('prototype.room');
    global.cache = {};
    global.cache.utils = require('utils');
    global.cache.stat = require('stat');
    global.cache.stat.init();
    global.cache.queueTransport = require('queue.transport');
    global.cache.queueTransport.init();
    global.cache.minerals = require('minerals');
    global.cache.minerals.init();
    global.cache.matrix = {};
    global.cache.wantCarry = {};
    global.cache.wantEnergy = {};
    global.cache.hostiles = {};
    global.cache.creepsByRoom = {};
    global.cache.creepsByRoomName = {};
    global.cache.objects = global.cache.objects || {};
    global.cache.boostingLabs = {};
    global.cache.targets = {};
    global.cache.skipSpawnNames = {};
    
    var moveErrors = {};
    global.cache.roomNames = _.filter( _.uniq( [].concat( 
        _.map(Game.flags, 'pos.roomName'), 
        _.map(Game.rooms, 'name'), 
        _.keys(Memory.rooms)
    ) ), n => n != "undefined");

    for(let name in Memory.creeps) {
        if(!Game.creeps[name]) {
            global.cache.stat.die(name);
            delete Memory.creeps[name];
            continue;
        }
        let creep = Game.creeps[name];
        let memory = Memory.creeps[name];
        if (memory.targetID) {
            global.cache.targets[memory.targetID] = (global.cache.targets[memory.targetID] || 0) + 1;
            if (memory.role == "harvester" || memory.role == "longharvester")
                global.cache.wantCarry[memory.targetID] = (global.cache.wantCarry[memory.targetID] || 0) + creep.carry.energy;
        }
        if (memory.errors > 0) {
            console.log(name + " has "+ memory.errors + " errors");
            moveErrors[creep.room.name] = 1;
        }
        if (memory.energyID) {
            global.cache.wantEnergy[memory.energyID] = global.cache.wantEnergy[memory.energyID] || {energy : 0, creepsCount : 0};
            global.cache.wantEnergy[memory.energyID].energy += creep.carryCapacity - _.sum(creep.carry);
            global.cache.wantEnergy[memory.energyID].creepsCount++;
        }
        global.cache.creepsByRoom[creep.room.name] = global.cache.creepsByRoom[creep.room.name] || [];
        global.cache.creepsByRoom[creep.room.name].push(creep);

        global.cache.creepsByRoomName[memory.roomName] = global.cache.creepsByRoomName[memory.roomName] || [];
        global.cache.creepsByRoomName[memory.roomName].push(creep);

        global.cache.stat.updateRole(memory.role, 'sum', 1);
    }

    global.cache.stat.addCPU("memory");

    _.forEach(global.cache.roomNames, function(roomName) {
        Game.roomsHelper.fakeUpdate(roomName);
    });

    _.forEach(global.cache.roomNames, function(roomName) {
        Game.roomsHelper.fakeUpdate2(roomName);
    });
    
    global.cache.stat.addCPU("roomUpdate");

    for (creep of _.sortBy( Game.creeps, c => CREEP_WEIGHT[c.memory.role] || CREEP_WEIGHT["default"])) {
        let lastCPU = Game.cpu.getUsed();
        let role = creep.memory.role;
        if(!(role in global.cache.objects)) {
            try {
                global.cache.objects[role] = require('role.' + role);
            } catch (e) {
                console.log(creep.name + " REQUIRE ERROR: " + e.toString() + " => " + e.stack);
                console.log(JSON.stringify("global.objects: " + global.cache.objects));
                continue;
            }
        }
        
        if(creep.spawning) {
            if ("prerun" in global.cache.objects[role]) {
                try {
                    global.cache.objects[role].prerun(creep);
                } catch (e) {
                    console.log(creep.name + " PRERUNNING ERROR: " + e.toString() + " => " + e.stack);
                    Game.notify(creep.name + " PRERUNNING ERROR: " + e.toString() + " => " + e.stack);
                }
            }
        } else if(moveErrors[creep.room.name]) {
            if(creep.moveTo(creep.room.controller) == OK)
                creep.memory.errors = 0;
        } else {
            try {
                creep.memory.carryEnergy = creep.carry.energy;
                if (!creep.memory.stop)
                    global.cache.objects[role].run(creep);
            } catch (e) {
                console.log(creep.name + " RUNNING ERROR: " + e.toString() + " => " + e.stack);
                Game.notify(creep.name + " RUNNING ERROR: " + e.toString() + " => " + e.stack);
            }
        }
        
        let cpu = Game.cpu.getUsed() - lastCPU;
        global.cache.stat.updateRoom(creep.room.name, 'cpu', cpu, creep.memory.roomName);
        global.cache.stat.updateRole(role, 'cpu', cpu);

        if (global.cache.utils.isLowCPU(1))
            break;
    }
    global.cache.stat.addCPU("run");
    
    if (Game.time % PERIOD_NEEDLIST == 0) {
        let needList = [];

        for (let roomName of global.cache.roomNames) {
            if (global.cache.utils.isLowCPU(1))
                break;

            let lastCPU = Game.cpu.getUsed();
            let room = Game.rooms[roomName];
            let limitList = [];

            let creepsCount = _.countBy(_.filter(global.cache.creepsByRoomName[roomName], c => c.ticksToLive > ALIVE_TICKS + c.body.length*3 || c.spawning), c => c.memory.countName || c.memory.role);
            let bodyCount = _.countBy( _.flatten( _.map( _.filter(global.cache.creepsByRoomName[roomName], c => c.ticksToLive > ALIVE_TICKS + c.body.length*3 || c.spawning ), function(c) { return _.map(c.body, function(p) {return c.memory.role + "," + p.type;});}) ) );
            let fcount = _.countBy(_.filter(Game.flags, f => f.pos.roomName == roomName), f => f.name.substring(0,f.name.indexOf('.')) );

            try {
                if (fcount["DisController"]) {
                    limitList = getDiscRoomLimits(roomName, creepsCount, fcount);
                } else if (fcount["Guard"]) {
                    limitList = getGuardRoomLimits(roomName, creepsCount, fcount);
                } else if (room && room.controller && room.controller.my) {
                    limitList = getRoomLimits(room, creepsCount, fcount);
                } else {
                    limitList = getNotMyRoomLimits(roomName, creepsCount, fcount);
                }
            } catch (e) {
                console.log(roomName + " NEEDLIST ERROR: " + e.toString() + " => " + e.stack);
                Game.notify(roomName + " NEEDLIST ERROR: " + e.toString() + " => " + e.stack);
            }

            if (!limitList.length)
                continue;

            for (let limit of limitList) {
                let notEnoughBody = 0;
                let hasBodyLimits = 0;
                if (limit["body"]) {
                    for (let part in limit["body"]) {
                        if (limit["body"][part])
                            hasBodyLimits = 1;
                        if ((bodyCount[limit.role + "," + part] || 0) < limit["body"][part])
                            notEnoughBody = 1;
                    }
                }
                if ( (creepsCount[limit.countName] || 0) < limit.count && (!hasBodyLimits || notEnoughBody) ) {
                    needList.push(limit);
                    creepsCount[limit.countName] = (creepsCount[limit.countName] || 0) + 1;
                }
            }

            global.cache.stat.updateRoom(roomName, 'cpu', Game.cpu.getUsed() - lastCPU);
        }
        console.log("needList=" + JSON.stringify(_.countBy(needList.sort(function(a,b) { return (a.priority - b.priority) || (a.wishEnergy - b.wishEnergy); } ), function(l) {return l.roomName + '.' + l.countName})));
        global.cache.stat.addCPU("needList");
        
        let skipRoomNames = {};
        let reservedEnergy = {};
        for (let need of needList.sort(function(a,b) { return (a.priority - b.priority) || (a.wishEnergy - b.wishEnergy); } )) {
            if (global.cache.utils.isLowCPU(1))
                break;

            if (!_.filter(Game.spawns, s => 
                    !s.spawning && 
                    !(s.name in global.cache.skipSpawnNames) && 
                    !(s.room.name in skipRoomNames)
            ).length) {
                //console.log("All spawns are spawning");
                break;
            }
            
            let res = getSpawnForCreate(need, skipRoomNames, reservedEnergy);
            if (res[0] == -2) {
                //console.log("needList: " + need.role + " for " + need.roomName + " has no spawns in range");
            } else if (res[0] == -1) {
                if (res[1])
                    skipRoomNames[res[1]] = 1;
                //console.log("needList: " + need.role + " for " + need.roomName + " return waitSpawnName=" + res[1]);
            } else if (res[0] == -3) {
                console.log("needList: " + need.role + " for " + need.roomName + " has no spawns with enough energyCapacity");
            } else if (res[0] == 0) {
                let spawn = res[1];
                let energy = res[2];
                if(!(need.role in global.cache.objects))
                    global.cache.objects[need.role] = require('role.' + need.role);
                let [body, leftEnergy] = global.cache.objects[need.role].create(energy, need.arg);
                if (leftEnergy < 0) {
                    console.log("FAIL TO CREATE: leftEnergy=" + leftEnergy + " for energy=" + energy + ", arg=" + need.arg + ", role=" + need.role);
                    continue;
                }
                let newName = need.role + "-" + _.round(Math.random()*1000);
                let opts = {
                    "memory": {
                        "role": need.role,
                        "spawnName": spawn.name,
                        "roomName" : need.roomName,
                        "energy" : energy - leftEnergy,
                        "arg" : need.arg,
                        "countName": need.countName,
                }};
                if (spawn.room.memory.spawnStructures.length)
                    opts["energyStructures"] = _.map(spawn.room.memory.spawnStructures, id => Game.getObjectById(id));

                let ret = spawn.spawnCreep(body, newName, opts);

                if(ret == OK) {
                    reservedEnergy[spawn.room.name] = (reservedEnergy[spawn.room.name] || 0) + (energy - leftEnergy);
                    global.cache.stat.updateRoom(need.roomName, 'create', -1 * (energy - leftEnergy));
                    console.log(spawn.name + ": BURNING " + newName + " (arg: " + JSON.stringify(need.arg) + ") for " + need.roomName + ", energy (" + energy + "->" + (energy - leftEnergy) + ") " + body.length + ":" + JSON.stringify(_.countBy(body)) );
                } else {
                    console.log(spawn.name + ": FAILED to burn: ret=" + ret + " of " + newName + " (arg: " + JSON.stringify(need.arg) + ") for " + need.roomName + ", energy (" + energy + "->" + (energy - leftEnergy) + ") ");
                }
                global.cache.skipSpawnNames[spawn.name] = 1;
            }
        }
        global.cache.stat.addCPU("create");
    }

    for (let roomName of global.cache.roomNames) {
        if (global.cache.utils.isLowCPU(1))
            break;
        let lastCPU = Game.cpu.getUsed();
        let room = Game.rooms[roomName];
    
        if (room && Memory.rooms[roomName].type == 'my') {
            towerAction(room);
            room.linkAction();
        }

        global.cache.stat.updateRoom(roomName, 'cpu', Game.cpu.getUsed() - lastCPU);
    }
    global.cache.stat.addCPU("roomActions");

    for (let roomName of global.cache.roomNames) {
        if (global.cache.utils.isLowCPU(1))
            break;
        let lastCPU = Game.cpu.getUsed();

        if (roomName in Memory.rooms && Memory.rooms[roomName].type == 'my')
            global.cache.minerals.runLabs(roomName);

        global.cache.stat.updateRoom(roomName, 'cpu', Game.cpu.getUsed() - lastCPU);
    }
    global.cache.stat.addCPU("runLabs");
    /*
    Memory.observeCache = Memory.observeCache || {};
    for (let roomName in Game.rooms) {
        if (global.cache.utils.isLowCPU(1, 1))
            break;
        if (!(Memory.rooms[roomName].structures[STRUCTURE_OBSERVER] || []).length)
            continue;
        let regex = /^(\w)(\d+)(\w)(\d+)$/;
        let match = regex.exec(roomName);
        if (!match) {
            console.log("Observe FAILED regexp of " + roomName);
            break;
        }
        let l1 = match[1];
        let l2 = match[3];
        let x0 = _.floor(parseInt(match[2]) / 10) * 10;
        let y0 = _.floor(parseInt(match[4]) / 10) * 10;
        let name0 = l1 + x0 + l2 + y0;
        if (!(name0 in Memory.observeCache))
            Memory.observeCache[name0] = {"x": x0, "y": y0};
        else if (Memory.observeCache[name0].over == Game.time)
            continue;

        let count = 121;
        while (count-- > 0) {
            let lastCPU = Game.cpu.getUsed();
            Memory.observeCache[name0].x++;
            if (Memory.observeCache[name0].x > x0 + 10) {
                Memory.observeCache[name0].x = x0;
                Memory.observeCache[name0].y++;
                if (Memory.observeCache[name0].y > y0 + 10) {
                    Memory.observeCache[name0].y = y0;
                    Memory.observeCache[name0].over = Game.time;
                }
            }
            let name = l1 + Memory.observeCache[name0].x + l2 + Memory.observeCache[name0].y;
            if (name in Memory.rooms && "structuresTime" in Memory.rooms[name] && Game.time - Memory.rooms[name].structuresTime < OBSERVE_INTERVAL)
                continue;

            let observer = Game.getObjectById( Memory.rooms[roomName].structures[STRUCTURE_OBSERVER][0].id );
            if (!observer) {
                console.log("Observe: can't load object in " + roomName + " by id=" + Memory.rooms[roomName].structures[STRUCTURE_OBSERVER][0].id);
                break;
            }
            let res = observer.observeRoom(name);
            //console.log("Observed room " + name + " by " + roomName + " (" + res + ")");
            global.cache.stat.updateRoom(name, 'cpu', Game.cpu.getUsed() - lastCPU);
            break;
        }
    }   
    global.cache.stat.addCPU("observe");
    */
    if (Game.time % PERIOD_AUTOMARKET == 0) {
        global.cache.utils.autoMarket({length:1, deals:1, type: "sell", really: 1});
        global.cache.utils.marketClear({really: 1});
        if (Game.market.credits > AUTOMARKET_MIN_CREDITS)
            global.cache.utils.autoMarket({length:1, deals:1, type: "buy", really: 1});
    }
    global.cache.stat.finish();
//});
};

function getGuardRoomLimits (roomName, creepsCount, fcount) {
    //let memory = Memory.rooms[roomName] || {structures : {}};
    //let room = Game.rooms[roomName];
    //if (!fcount["Guard"])
    //    return [];
    
    let limits = [];
    limits.push({
        "role" : "guarder",
        "count" : 1,
        "priority" : 1,
        "wishEnergy" : 2520,
        "minEnergy" : 2520,
        "range": 7,
    });

    for (let limit of limits) {
        limit["roomName"] = roomName;
        limit["originalEnergyCapacity"] = 0;
        if (!("minEnergy" in limit))
            limit["minEnergy"] = 0;
        if (!("countName" in limit))
            limit["countName"] = limit.role;
    }

    //console.log(roomName + ": CPU=" + _.floor(Game.cpu.getUsed() - lastCPU, 2) + "; limits=" + JSON.stringify(limits));

    return limits;
}

function getDiscRoomLimits (roomName, creepsCount, fcount) {
    let memory = Memory.rooms[roomName] || {structures : {}};
    let room = Game.rooms[roomName];
    if (!fcount["DisController"])
        return [];
    
    let disClaimercount = 0;
    if (   STRUCTURE_CONTROLLER in memory.structures
        && memory.structures[STRUCTURE_CONTROLLER].length
        && memory.type == "hostiled"
        && ( !memory.lastAttackController
             || memory.lastAttackController + CONTROLLER_ATTACK_BLOCKED_UPGRADE - 150 - DISCLAIMER_CLAIM_COUNT * 2 * CREEP_SPAWN_TIME < Game.time
        ))
        disClaimercount = 1;

    let limits = [];
    limits.push({
        "role" : "disclaimer",
        "count" : disClaimercount,
        "priority" : 1,
        "wishEnergy" : 12350,
        "minEnergy" : 12350,
        "range": 5,
    });

    for (let limit of limits) {
        limit["roomName"] = roomName;
        limit["originalEnergyCapacity"] = 0;
        if (!("minEnergy" in limit))
            limit["minEnergy"] = 0;
        if (!("countName" in limit))
            limit["countName"] = limit.role;
    }

    //console.log(roomName + ": CPU=" + _.floor(Game.cpu.getUsed() - lastCPU, 2) + "; limits=" + JSON.stringify(limits));

    return limits;
}

function getNotMyRoomLimits (roomName, creepsCount, fcount) {
    let lastCPU = Game.cpu.getUsed();
    let memory = Memory.rooms[roomName] || {structures : {}};
    let room = Game.rooms[roomName];
    if (!fcount["Antikeeper"] && !fcount["Energy"] && !fcount["Controller"] && memory.type != "banked")
        return [];
    let buildTicks = room && room.getConstructions().length ? room.getBuilderTicks() : 0;
    let liteClaimer = memory.type == 'reserved' && memory.reserveEnd - Game.time > 3000 || Memory.claimRoom == roomName ? 1 : 0;
    let sourcesForWork = (memory.structures[STRUCTURE_SOURCE] || []).length;
    let sourcesCapacity = _.sum(memory.structures[STRUCTURE_SOURCE], s => s.energyCapacity);
    let sourcesWorkCapacity = _.sum(memory.structures[STRUCTURE_SOURCE], s => !s.minersFrom ? s.energyCapacity : 0);
    let antikeepersCount = (creepsCount["antikeeper-a"] || 0) + (creepsCount["antikeeper-r"] || 0);
    let pairedSources = _.sum(memory.structures[STRUCTURE_SOURCE], s => s.pair);
    let pairedExtractor = room ? room.getPairedExtractor(1) : null;

    let needSpeed = sourcesCapacity / ENERGY_REGEN_TIME * (memory.type == 'lair' ? 1.2 : 1);
    let needWorkSpeed = sourcesWorkCapacity / ENERGY_REGEN_TIME * (memory.type == 'lair' ? 1.2 : 1);
    let haveSpeed = 0;
    let haveWorkSpeed = 0;
    _.forEach( _.filter(Game.creeps, c => c.memory.role == "longharvester" && c.memory.roomName == roomName && (c.ticksToLive > ALIVE_TICKS + c.body.length*3 || c.spawning) ), function(c) {
        if (!c.memory.containerRoomName)
            return;

        let carryDistance;
        if (memory.pathCache)
            carryDistance = travel.getRoomsAvgPathLength(memory.pathCache, c.memory.containerRoomName) * 2;
        if (!carryDistance)
            carryDistance = Game.map.getRoomLinearDistance(c.memory.containerRoomName, roomName) * 50 * 2;

        let carryCapacity = _.sum(c.body, p => p.type == CARRY) * CARRY_CAPACITY;
        let workParts = _.sum(c.body, p => p.type == WORK);
        let workSpeed = workParts * HARVEST_POWER;
        let workTicks = workParts > 1 && haveWorkSpeed < needWorkSpeed ? carryCapacity/workSpeed : 0;
        haveSpeed += carryCapacity / (carryDistance + workTicks);
        if (workParts > 1)
            haveWorkSpeed += carryCapacity / (carryDistance + workTicks);
    });
    let needHarvester = needSpeed > haveSpeed || needWorkSpeed > haveWorkSpeed ? 1 : 0;
    let workerHarvester = needWorkSpeed > haveWorkSpeed ? 1 : 0;
    //if (needSpeed)
    //    console.log(`getNotMyRoomLimits for ${roomName}: needSpeed=` + _.floor(needSpeed, 1) + `, haveSpeed=` + _.floor(haveSpeed, 1) + `, needWorkSpeed=` + _.floor(needWorkSpeed, 1) + `, haveWorkSpeed=` + _.floor(haveWorkSpeed, 1) + `, needHarvester=${needHarvester}`);
    
    let limits = [];
    limits.push({
        "role" : "defender",
        "count" : memory.type != 'lair' && memory.type != 'banked' && Game.roomsHelper.getHostilesCount(roomName) > 1 ? 1 : 0,
        "priority" : 3,
        "wishEnergy" : 1500,
        "minEnergy" : 1500,
        "range": 3,
    },{
        "role" : "longharvester",
        "count" : fcount["Energy"] ? global.cache.utils.clamp(_.ceil((memory.energy || 0) / 10000), 1, 5) : 0,
        "arg" : {work: 0, attack: 0},
        "priority" : 10,
        "minEnergy" : 550,
        "wishEnergy" : 1500,
        "range" : 3,
        "maxEnergy" : 3000,
    },{
        "role" : "longharvester",
        "count" : memory.type == 'lair' || memory.type == 'central' || memory.type == 'banked' || Memory.claimRoom == roomName || fcount["Energy"] ? 0 : needHarvester * sourcesForWork,
        "arg" : {work: workerHarvester, attack: 1},
        "priority" : 10,
        "minEnergy" : 550,
        "wishEnergy" : 1500,
        "range" : 3,
        "maxEnergy" : 3000,
    },{
        "role" : "claimer",
        "count" : fcount["Controller"],
        "arg" : liteClaimer,
        "priority" : 11,
        "minEnergy" : 650,
        "wishEnergy" : liteClaimer ? 650 : 1300,
        "range" : 5,
    },{
        "role" : "longminer",
        "count" : memory.type == 'lair' || memory.type == 'central' || memory.type == 'banked' || Memory.claimRoom == roomName || fcount["Energy"] ? 0 : pairedSources,
        "arg" : {long: 0, attack: 1},
        "priority" : 12,
        "wishEnergy" : 1060,
        "minEnergy" : 1060,
        "range" : 3,
    },{
        "role" : "longbuilder",
        "count" : buildTicks && creepsCount["longharvester"] && !(memory.type == 'lair' && !antikeepersCount) ? 1 : 0,
        "priority" : 13,
        "wishEnergy" : buildTicks > 15000 ? 1500 : 1000,
        "range" : 3,
        "maxEnergy" : buildTicks > 15000 ? 2000 : 1000,
    },{
        "role" : "longharvester",
        "count" : memory.type == 'lair' || memory.type == 'central' || memory.type == 'banked' || !needHarvester || Memory.claimRoom == roomName || fcount["Energy"] ? 0 : (creepsCount["longharvester"] || 0) + 1,
        "arg" : {work: workerHarvester, attack: 1},
        "priority" : 14,
        "minEnergy" : 550,
        "wishEnergy" : 1500,
        "range" : 3,
        "maxEnergy" : 3000,
    },{
        "role" : "antikeeper",
        "count" : memory.type == 'lair' ? 1 : 0,
        "priority" : _.sum(creepsCount) > 5 ? 3 : 15,
        "wishEnergy" : 3920,
        "minEnergy" : 3920,
        "range" : 3,
        "arg" : 1,
        "countName" : "antikeeper-a",
    },{
        "role" : "antikeeper",
        "count" : memory.type == 'lair' ? 1 : 0,
        "priority" : _.sum(creepsCount) > 5 ? 3 : 15,
        "wishEnergy" : 4560,
        "minEnergy" : 4560,
        "range" : 3,
        "arg" : 0,
        "countName" : "antikeeper-r",
    },{
        "role" : "longharvester",
        "count" : antikeepersCount || memory.type == "central" ? needHarvester * sourcesForWork : 0,
        "arg" : {work: workerHarvester, attack: memory.type == "lair" ? 0 : 1},
        "priority" : 16,
        "minEnergy" : 550,
        "wishEnergy" : 1500,
        "range" : 3,
        "maxEnergy" : 4000,
    },{
        "role" : "longminer",
        "count" : antikeepersCount || memory.type == "central" ? pairedSources : 0,
        "arg" : {long: 1, attack: memory.type == "lair" ? 0 : 1},
        "priority" : 17,
        "wishEnergy" : memory.type == "lair" ? 1450 : 1660,
        "minEnergy" : memory.type == "lair" ? 1200 : 1410,
        "range" : 3,
    },{
        role : "mineralminer",
        "count" : (antikeepersCount || memory.type == "central") && pairedExtractor ? 1 : 0,
        "arg": pairedExtractor ? 1 : 0,
        "priority" : 18,
        "minEnergy": 700,
        "wishEnergy" : 3150,
        "maxEnergy" : 3150,
        "range": 3,
    },{
        "role" : "longharvester",
        "count" : (antikeepersCount || memory.type == "central") && needHarvester ? (creepsCount["longharvester"] || 0) + 1 : 0,
        "arg" : {work: workerHarvester, attack: memory.type == "lair" ? 0 : 1},
        "priority" : 19,
        "minEnergy" : 550,
        "wishEnergy" : 1500,
        "range" : 3,
        "maxEnergy" : 4000,
    });

    for (let limit of limits) {
        limit["roomName"] = roomName;
        limit["originalEnergyCapacity"] = 0;
        if (!("minEnergy" in limit))
            limit["minEnergy"] = 0;
        if (!("countName" in limit))
            limit["countName"] = limit.role;
    }

    //console.log(roomName + ": CPU=" + _.floor(Game.cpu.getUsed() - lastCPU, 2) + "; limits=" + JSON.stringify(limits));

    return limits;
}

function getRoomLimits (room, creepsCount, fcount) {
    let lastCPU = Game.cpu.getUsed();
    let memory = Memory.rooms[room.name] || {structures : {}};

    let builds = (memory.constructions || 0) - (memory.constructionsRoads || 0);
    let repairs = memory.repairs || 0;
    let unminerSources = _.sum(memory.structures[STRUCTURE_SOURCE], s => !s.minersFrom);
    let sources = (memory.structures[STRUCTURE_SOURCE] || []).length;
    let pairedSources = _.sum(memory.structures[STRUCTURE_SOURCE], s => s.pair);
    let countHarvester = _.max([unminerSources, _.ceil((memory.structures[STRUCTURE_EXTENSION] || []).length / 15)]);
    let storagedLink = _.sum(memory.structures[STRUCTURE_LINK], l => l.storaged);
    let unStoragedLinks = (room.getUnStoragedLinks() || []).length;
    let controlleredContainer = (room.checkControlleredContainer() || room.checkControlleredLink() ) && memory.freeEnergy > 2000;
    let pairedExtractor = room.getPairedExtractor(1);
    let freeEnergyCount = _.ceil((memory.freeEnergy || 1) / 1000);
    let transportAmountIn = _.sum(_.filter(Memory.transportRequests, r => r.fromRoomName == room.name && r.fromRoomName == r.toRoomName), r => r.amount);
    let transportAmountOut = _.sum(_.filter(Memory.transportRequests, r => r.toRoomName == room.name && r.fromRoomName != r.toRoomName), r => r.amount);
    //let builderCount = (builds ? (builds > 5 && room.controller.level >= 8 ? 3 : (builds < 5 ? _.ceil(builds/2) : 3)) : 0) + (repairs > 10 ? 2 : (repairs ? 1 : 0)) + (repairs > 20 && room.controller.level >= 8 ? 2 : 0);
    let builderWorkCount = global.cache.utils.clamp( _.min([_.ceil(room.getBuilderTicks() / (CREEP_LIFE_TIME * 0.6)), _.ceil((memory.freeEnergy + 1) / (2.5 * CREEP_LIFE_TIME * 0.6) ) ]), 0, 100 );
    
    let limits = [];
    limits.push({
            "role" : "harvester",
            "count" : memory.structures[STRUCTURE_SPAWN] ? 1 : 0,
            "arg" : {work: unminerSources ? 1 : 0, top: room.controller.level >= 7},
            "priority" : 1,
            "minEnergy" : 300,
            "wishEnergy" : !creepsCount["harvester"] ? 300 : (room.controller.level >= 7 ? 2700 : 1350),
    },{
            "role" : "miner",
            "count" : _.min([pairedSources, 1]),
            "priority" : 2,
            "minEnergy" : 550,
            "wishEnergy" : 850,
    },{
            "role" : "defender",
            "count" : Game.roomsHelper.getHostilesCount(room.name) * 2,
            "arg" : memory.structures[STRUCTURE_TOWER] ? 1 : 0,
            "priority" : 2,
            "wishEnergy" : 1500,
            "minEnergy" : 1500,
    },{
            "role" : "harvester",
            "count" : memory.structures[STRUCTURE_SPAWN] ? countHarvester : 0,
            "arg" : {work: unminerSources ? 1 : 0, top: room.controller.level >= 7},
            "priority" : 3,
            "wishEnergy" : room.controller.level >= 7 ? 2700 : 1350,
            "body" : {
                "work" : 10*unminerSources * (room.controller.level >= 7 ? 2 : 1),
                "carry" : 10*countHarvester * (room.controller.level >= 7 ? 2 : 1),
            },
    },{
            "role" : "miner",
            "count" : pairedSources,
            "priority" : 3,
            "minEnergy" : 550,
            "wishEnergy" : 850,
    },{
            role : "upgrader",
            "count" : room.controller.level < 8 ? 5 : 1,
            "priority" : 4,
            "arg": {top: room.controller.level >= 8, controllered: controlleredContainer},
            "wishEnergy" : 1500,
            "body" : {
                "work" : 3*freeEnergyCount,
                "carry" : 3*freeEnergyCount,
            },
    },{
            "role" : "builder",
            "count" : builderWorkCount ? (creepsCount["builder"] || 0) + 1 : 0,
            "priority" : 5,
            "wishEnergy" : 1500,
            "maxEnergy" : builderWorkCount > 30 ? 5000 : 1500,
            "body" : {
                "work" : builderWorkCount,
            },
    },{
            "role" : "shortminer",
            "count" : storagedLink && unStoragedLinks ? 1 : 0,
            "priority" : (creepsCount["miner"] || 0) >= pairedSources ? 3 : 6,
            "wishEnergy" : 300,
    },{
            role : "mineralminer",
            "count" : pairedExtractor ? 1 : 0,
            "arg": pairedExtractor && pairedExtractor.buildContainerID ? 1 : 0,
            "priority" : 8,
            "minEnergy": 700,
            "wishEnergy" : pairedExtractor && pairedExtractor.buildContainerID ? 3150 : 3950,
            "maxEnergy" : pairedExtractor && pairedExtractor.buildContainerID ? 3150 : 3950,
    },{
            role : "transporter",
            "count" : global.cache.utils.clamp(_.ceil(transportAmountIn / TRANSPORTER_IN_CREATING_AMOUNT), 0, 3),
            "priority" : 9,
            "wishEnergy" : 1500,
            "maxEnergy" : 1500,
            "arg": "in",
            "countName" : "transporter-in",
    },{
            role : "transporter",
            "count" : global.cache.utils.clamp(_.ceil(transportAmountOut / TRANSPORTER_OUT_CREATING_AMOUNT), 0, 6),
            "priority" : 9,
            "wishEnergy" : 1500,
            "maxEnergy" : 1500,
            "arg": "out",
            "countName" : "transporter-out",
    },{
            role : "scout",
            "count" : memory.scoutCount || 0,
            "priority" : 1,
            "wishEnergy" : 50,
    },{
            role : "attacker",
            "count" : memory.attackerCount || 0,
            "priority" : 1,
            "wishEnergy" : 5000,
    },{
            role : "healer",
            "count" : memory.healerCount || 0,
            "priority" : 1,
            "wishEnergy" : 5000,
    },{
            role : "dismantler",
            "count" : memory.dismantlerCount || 0,
            "priority" : 4,
            "minEnergy" : 3300,
            "wishEnergy" : 3300,
    },{
            role : "superhealer",
            "count" : memory.superhealerCount || 0,
            "priority" : 4,
            "minEnergy" : 2100,
            "maxEnergy" : 7500,
    },{
            role : "superattacker",
            "count" : memory.superattackerCount || 0,
            "priority" : 4,
            "minEnergy" : 2800,
            "maxEnergy" : 2800,
    });

    for (let limit of limits) {
        limit["roomName"] = room.name;
        limit["originalEnergyCapacity"] = room.energyCapacityAvailable;
        if (!("range" in limit))
            limit["range"] = 5;
        if (!("minEnergy" in limit))
            limit["minEnergy"] = 0;
        if (!("countName" in limit))
            limit["countName"] = limit.role;
    }

    //console.log(room.name + ": CPU=" + _.floor(Game.cpu.getUsed() - lastCPU, 2) + "; limits=" + JSON.stringify(limits));

    return limits;
}

function getSpawnForCreate (need, skipRoomNames, reservedEnergy) {
    let spawnsInRange = _.filter(Game.spawns, s => 
        !s.spawning && 
        !(s.name in global.cache.skipSpawnNames) && 
        !(s.room.name in skipRoomNames) &&
        (s.room.getPathToRoom(need.roomName) && s.room.getPathToRoom(need.roomName) < need.range * 50 || s.room.name == need.roomName) &&
        s.isActive()
    );
    
    if (!spawnsInRange.length)
        return [-2];
    
    //if (need.minEnergy && _.maxBy(spawnsInRange, function(s) {return s.room.energyCapacityAvailable} ).room.energyCapacityAvailable < need.minEnergy)
    //    return [-3];

    let waitRoomName = null;
    for (let spawn of _.sortBy(spawnsInRange, s => s.room.name == need.roomName ? -1 : s.room.getPathToRoom(need.roomName))) {
        if (spawn.room.name == waitRoomName)
            continue;
        let energy = spawn.room.energyAvailable - (reservedEnergy[spawn.room.name] || 0);
        //console.log("getSpawnForCreate: " + need.roomName + " wants " + need.role + ", skipSpawnNames=" + JSON.stringify(global.cache.skipSpawnNames) + ":" + spawn.name + " minEnergy=" + need.minEnergy + ", energyAvailable=" + spawn.room.energyAvailable + ", wishEnergy=" + need.wishEnergy + ", energy=" + energy);
        if (
            energy >= need.minEnergy &&
            (
                energy >= need.wishEnergy ||
                energy >= spawn.room.energyCapacityAvailable && energy >= need.originalEnergyCapacity
            )
        ) {
            if (need.maxEnergy && energy > need.maxEnergy)
                energy = need.maxEnergy;
            return [0, spawn, energy];
        } else if (!waitRoomName && spawn.room.energyCapacityAvailable >= need.minEnergy) {
            waitRoomName = spawn.room.name;
        }
    }

    return [-1, waitRoomName];
}

function towerAction (room) {
    let towers = room.getTowers();
    if (!towers.length)
        return;
    
    let dstructs = room.find(FIND_STRUCTURES, {filter: s => s.structureType != STRUCTURE_ROAD && s.hits < 0.5*s.hitsMax && s.hits < REPAIR_TOWER_LIMIT && s.isActive()});

    for(let tower of towers) {
        let target;
        if(target = room.find(FIND_HOSTILE_CREEPS).sort(function (a,b) { return a.hits - b.hits;})[0]) {
            tower.attack(target);
            console.log("Tower " + room.name + "." + tower.id + " attacked hostile: owner=" + target.owner.username + "; hits=" + target.hits);
        } else if (target = room.find(FIND_MY_CREEPS, {filter : c => c.hits < c.hitsMax})[0]) {
            tower.heal(target);
            console.log("Tower " + room.name + "." + tower.id + " healed " + target.name + " (" + target.hits + "/" + target.hitsMax + ")");
        } else if(dstructs.length && tower.energy > 700) {
            let dstruct = dstructs.sort(function (a,b) {return a.hits - b.hits;})[0];
            tower.repair(dstruct);
        }
    }
}