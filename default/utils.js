const profiler = require('screeps-profiler');

function _addPosition (creep, res, pos, x, y) {
    let newx = parseInt(pos.x) + parseInt(x);
    if (newx < 1 || newx > 48)
        return;
    let newy = parseInt(pos.y) + parseInt(y);
    if (newy < 1 || newy > 48)
        return;
    let npos = new RoomPosition(newx, newy, pos.roomName);
    for (let t of npos.lookFor(LOOK_TERRAIN)) {
        if (t == "wall")
            return;
    }
    for (let s of npos.lookFor(LOOK_STRUCTURES)) {
        if ([STRUCTURE_CONTAINER, STRUCTURE_ROAD, STRUCTURE_RAMPART].indexOf(s.structureType) == -1)
            return;
    }
    if (creep) {
        for (let c of npos.lookFor(LOOK_CREEPS)) {
            if (c != creep)
                return;
        }
    }
    res.push(npos);
}

function _checkPosFree (pos, costs, ext) {
    if (pos.x < 2 || pos.x > 47 || pos.y < 2 || pos.y > 47)
        return false;

    for (let t of pos.lookFor(LOOK_TERRAIN)) {
        if (t == "wall")
            return false;
    }

    if (costs.get(pos.x, pos.y) == 0xff) {
        if (!ext)
            return false;
        for (let s of pos.lookFor(LOOK_STRUCTURES)) {
            if ([STRUCTURE_EXTENSION, STRUCTURE_ROAD, STRUCTURE_RAMPART].indexOf(s.structureType) == -1)
                return false;
        }
        return true;
    }

    for (let s of pos.lookFor(LOOK_STRUCTURES)) {
        if ([STRUCTURE_ROAD, STRUCTURE_RAMPART].indexOf(s.structureType) == -1)
            return false;
    }
    
    return true;
}

function _getMarketPrices (orders, rt) {
    let prices = {sell: {sum: 0, amount: 0, min: null, max: null}, buy: {sum: 0, amount: 0, min: null, max: null}};
    for (let order of _.filter(orders, o => o.resourceType == rt && o.amount > 0)) {
        if (order.price < 0.01 || order.price > 10)
            continue;
        let hash = order.type == ORDER_BUY ? prices.buy : prices.sell;
        if (!hash.amount) {
            hash.max = order.price;
            hash.min = order.price;
        } else if (order.price < hash.min) {
            hash.min = order.price;
        } else if (order.price > hash.max) {
            hash.max = order.price;
        }
        hash.amount += order.amount;
        hash.sum += order.price * order.amount;
    }
    for (let type of ["buy", "sell"]) {
        prices[type].avg = prices[type].amount ? _.ceil(prices[type].sum / prices[type].amount, 3) : 0;
        delete prices[type].sum;
        delete prices[type].amount;
    }
    delete prices["sell"].max;
    delete prices["buy"].min;
    prices["mid"] = prices["sell"].min > 0 && prices["buy"].max > 0 ? _.ceil((prices["sell"].min + prices["buy"].max * 1.1) / 2, 3) : null;
    if (prices["mid"]) {
        prices["mid"] = utils.clamp(prices["mid"], prices["sell"].min * 0.9, prices["buy"].max * 2);
        prices["mid"] = _.ceil(prices["mid"], 3);

        prices["midSell"] = utils.clamp(prices["mid"] * 0.95, prices["sell"].min * 0.99, prices["mid"]);
        prices["midBuy"] = utils.clamp(prices["mid"] * 1.05, prices["mid"], prices["buy"].max * 1.01);
    }

    return prices;
}

var utils = {
    checkPosForExtension : function (pos, costs) {
        if (!_checkPosFree(pos, costs) || 
            !_checkPosFree(pos.change(-1, 0, 1), costs) ||
            !_checkPosFree(pos.change(1, 0, 1), costs) ||
            !_checkPosFree(pos.change(0, -1, 1), costs) ||
            !_checkPosFree(pos.change(0, 1, 1), costs) ||
            !_checkPosFree(pos.change(-1, -1, 1), costs, 1) ||
            !_checkPosFree(pos.change(1, -1, 1), costs, 1) ||
            !_checkPosFree(pos.change(-1, 1, 1), costs, 1) ||
            !_checkPosFree(pos.change(1, 1, 1), costs, 1)
        )
            return false;
        
        return true;
    },

    clamp : function (n, min, max) {
        return n < min ? min : (n > max ? max : n);
    },

    getRangedPlaces : function (creep, pos, range) {
        let res = [];
        for (let x = -1 * range; x <= range; x++)
            for (let y of [-1 * range,range])
                _addPosition(creep, res, pos, x, y);
        for (let y = -1 * range + 1; y <= range - 1; y++)
            for (let x of [-1 * range,range])
                _addPosition(creep, res, pos, x, y);

        return res;
    },
   
    try_attack : function (creep, all) {
        let target;
        if(!target && all)
            target = creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, {ignoreDestructibleStructures : true, filter : s => s.structureType == STRUCTURE_TOWER});
        if(!target && all)
            target = creep.pos.findClosestByPath(FIND_HOSTILE_SPAWNS, {ignoreDestructibleStructures : true});
        if(!target)
            target = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS, {ignoreDestructibleStructures : true});
        if(!target && all)
            target = creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, {ignoreDestructibleStructures : true, filter : s => s.structureType != STRUCTURE_CONTROLLER});
        /*
        if(!target && creep.memory.targetID && Game.getObjectById(creep.memory.targetID))
            target = Game.getObjectById(creep.memory.targetID);
        let con_creep = _.filter(Game.creeps, c => c.memory.role == "defender" && c.room == creep.room && c.memory.targetID && c != creep)[0];
        if(con_creep && (!creep.memory.targetID || creep.memory.targetID!=con_creep.memory.targetID) && Game.getObjectById(con_creep.memory.targetID)) {
            target = Game.getObjectById(con_creep.memory.targetID);
            console.log(creep.name + " found con_creep " + con_creep.name + " with target=" + con_creep.memory.targetID);
        }
        */
        if(target) {
            creep.memory.targetID = target.id;
            if(!creep.getActiveBodyparts(ATTACK)) {
                console.log(creep.name + " has no ATTACK parts, but hostile in room, go away");
                return 0;
            }
            if (Game.time % 10 == 0)
                console.log(creep.name +
                    " attacks: owner=" + (target.owner ? target.owner.username : 'no owner') +
                    "; ticksToLive=" + target.ticksToLive +
                    "; hits=" + target.hits + 
                    "; structureType=" + target.structureType
                );
            let res = creep.attack(target);
            if(res == ERR_NOT_IN_RANGE) {
                let res = creep.moveTo(target); //, {ignoreDestructibleStructures : (creep.room.controller.my ? false : true)});
                //let res = creep.moveTo(target);
                if(res < 0) {
                    //console.log(creep.name + " moved in attack with res=" + res);
                }
            } else if (res < 0) {
                console.log(creep.name + " attacked with res=" + res);
            }
            return 1;
        }
    	return -1;
    },

    checkInRoomAndGo : function (creep) {
        if (creep.pos.roomName == creep.memory.roomName)
            return 1;

        if(!Game.rooms[creep.memory.roomName])
            console.log(creep.name + ": no room " + creep.memory.roomName);
        else 
            creep.moveTo(Game.rooms[creep.memory.roomName].controller);

        return 0;
    },
    
    lzw_encode: function (s) {
        var dict = {};
        var data = (s + "").split("");
        var out = [];
        var currChar;
        var phrase = data[0];
        var code = 256;
        for (var i=1; i<data.length; i++) {
            currChar=data[i];
            if (dict[phrase + currChar] != null) {
                phrase += currChar;
            }
            else {
                out.push(phrase.length > 1 ? dict[phrase] : phrase.charCodeAt(0));
                dict[phrase + currChar] = code;
                code++;
                phrase=currChar;
            }
        }
        out.push(phrase.length > 1 ? dict[phrase] : phrase.charCodeAt(0));
        for (var i=0; i<out.length; i++) {
            out[i] = String.fromCharCode(out[i]);
        }
        return out.join("");
    },
    
    // Decompress an LZW-encoded string
    lzw_decode: function (s) {
        var dict = {};
        var data = (s + "").split("");
        var currChar = data[0];
        var oldPhrase = currChar;
        var out = [currChar];
        var code = 256;
        var phrase;
        for (var i=1; i<data.length; i++) {
            var currCode = data[i].charCodeAt(0);
            if (currCode < 256) {
                phrase = data[i];
            }
            else {
               phrase = dict[currCode] ? dict[currCode] : (oldPhrase + currChar);
            }
            out.push(phrase);
            currChar = phrase.charAt(0);
            dict[code] = oldPhrase + currChar;
            code++;
            oldPhrase = phrase;
        }
        return out.join("");
    },

    extendX: function(price) {
        for (order of _.filter(Game.market.orders, o => o.resourceType == "X" && o.type == ORDER_BUY)) {
            if (price) {
                let res = Game.market.changeOrderPrice(order.id, price);
                if (res != OK)
                    console.log(`Change price for ${order.id} with res ${res}`);
            }
            Game.market.extendOrder(order.id, 10000);
        }
    },

    marketClear: function(options = {}) {
        let print = "\n";
        for(let order of _.filter(Game.market.orders, o => !o.remainingAmount)) {
            print += `\t${order.id} from ${order.roomName} ${order.type} ${order.resourceType} created ${Game.time - order.created} sec ago`;
            if (options.really) {
                let res = Game.market.cancelOrder(order.id);
                print += ` (${res})`
            }
            print += "\n";
        }
        console.log(print);
    },

    autoMarket: function(options = {}) {
        let orders = Game.market.getAllOrders();
        let cache = {};
        let max = options.max || 10000;
        let print = "\n";
        let oldPrint = '';
        for (let room of _.filter(Game.rooms, r => 
                r.terminal && r.controller.my && (!options.roomName || r.name == options.roomName) 
        )) {
            oldPrint = print;
            print += room.name + ":\n";
            let any = 0;
            if (!options.type || options.type == "sell") {
                print += "\tSELL\n";
                for (let rt in room.terminal.store) {
                    if (rt == "energy" || room.terminal.store[rt] < 1000 || options.length && rt.length > options.length)
                        continue;
                    print += "\t" + rt + ": " + room.terminal.store[rt] + "; ";
                    
                    if (!(rt in cache))
                        cache[rt] = _getMarketPrices(orders, rt);
                    let midPrice = cache[rt].midSell;
                    let amount = this.clamp(room.terminal.store[rt], 0, max);

                    let order = _.find(Game.market.orders, o => o.resourceType == rt && o.type == ORDER_SELL && o.roomName == room.name);
                    if (order) {
                        print += "MY: {id:" + order.id + ", price:" + order.price + ", amount:" + order.amount + "}; ";
                        if (midPrice && order.price != midPrice) {
                            print += "\n";
                            print += `\tGame.market.changeOrderPrice("${order.id}", ${midPrice});`;
                            if (options.really) {
                                let res = Game.market.changeOrderPrice(order.id, midPrice);
                                print += ` (${res})`;
                            }
                            if (order.amount < amount) {
                                print += "\n";
                                print += `\tGame.market.extendOrder("${order.id}", ${amount - order.amount});`;
                                if (options.really) {
                                    let res = Game.market.extendOrder(order.id, amount - order.amount);
                                    print += ` (${res})`;
                                }
                            }
                        }
                    } else if (midPrice) {
                        print += "\n";
                        print += `\tGame.market.createOrder(ORDER_SELL, ${rt}, ${midPrice}, ${amount}, ${room.name});`;
                        if (options.really) {
                            let res = Game.market.createOrder(ORDER_SELL, rt, midPrice, amount, room.name);
                            print += ` (${res})`;
                        }
                    }
                    print += "\n";
                    any++;
                }
            }
            if (!options.type || options.type == "buy") {
                print += "\tBUY\n";    
                let nr = room.memory.needResources;
                if (!nr)
                    continue;
                for(let rt in nr) {
                    if (rt.length > 1 || nr[rt] < 1000 || rt == "G")
                        continue;
                    print += "\t" + rt + ":" + nr[rt] + "; ";
                    if (!(rt in cache))
                        cache[rt] = _getMarketPrices(orders, rt);
                    let midPrice = cache[rt].midBuy;
                    let amount = this.clamp(nr[rt], 0, max);

                    let order = _.find(Game.market.orders, o => o.resourceType == rt && o.type == ORDER_BUY && o.roomName == room.name);
                    if (order) {
                        print += "MY: {id:" + order.id + ", price:" + order.price + ", amount:" + order.amount + "}; ";
                        if (midPrice && order.price != midPrice) {
                            print += "\n";
                            print += `\tGame.market.changeOrderPrice("${order.id}", ${midPrice});`;
                            if (options.really) {
                                let res = Game.market.changeOrderPrice(order.id, midPrice);
                                print += ` (${res})`;
                            }
                            if (order.amount < amount) {
                                print += "\n";
                                print += `\tGame.market.extendOrder("${order.id}", ${amount - order.amount});`;
                                if (options.really) {
                                    let res = Game.market.extendOrder(order.id, amount - order.amount);
                                    print += ` (${res})`;
                                }
                            }
                        }
                    } else if (midPrice) {
                        print += "\n";
                        print += `\tGame.market.createOrder(ORDER_BUY, ${rt}, ${midPrice}, ${amount}, ${room.name});`;
                        if (options.really) {
                            let res = Game.market.createOrder(ORDER_BUY, rt, midPrice, amount, room.name);
                            print += ` (${res})`;
                        }
                    }
                    print += "\n";
                    any++;
                } 
                    
            }
            if (!any)
                print = oldPrint;
        }
        print += "\n";
        for (let rt in cache)
            print += rt + ":\t" + cache[rt].mid + "\t" + JSON.stringify(cache[rt]) + "\n";
        console.log(print);
    },

    isLowCPU: function(silent, save) {
        let left = Game.cpu.tickLimit - Game.cpu.getUsed();
        let stop = 0;

        if (save && Game.cpu.bucket < CPU_LIMIT_SAVE)
            stop = 1;
        else
            stop = left < (Game.cpu.bucket < Game.cpu.limit ? CPU_LIMIT_HIGH : CPU_LIMIT_LOW);

        if (!silent && stop) {
            let caller = (new Error()).stack.split('\n')[3].trim();
            console.log("BREAK: cpu left " + _.floor(left) + " stopped at " + caller);
        }
        return stop;
    },

    memoryProfiler: function() {
        let hash = {};
        for (let key in Memory) {
            hash[key] = {};
            hash[key].length = JSON.stringify(Memory[key]).length;
            let cpu = Game.cpu.getUsed();
            let some = JSON.parse(JSON.stringify(Memory[key]));
            hash[key].cpu = Game.cpu.getUsed() - cpu;
        }
        
        let hash2 = {};
        for (let roomName in Memory.rooms) {
            for (let key in Memory.rooms[roomName]) {
                hash2[key] = hash2[key] || {};
                hash2[key].length = (hash2[key].length || 0) + JSON.stringify(Memory.rooms[roomName][key]).length;
                let cpu = Game.cpu.getUsed();
                let some = JSON.parse(JSON.stringify(Memory.rooms[roomName][key]));
                hash2[key].cpu = (hash2[key].cpu || 0) + (Game.cpu.getUsed() - cpu);
            }
        }

        let hash4 = {};
        for (let roomName in Memory.rooms) {
            if (!("structures" in Memory.rooms[roomName]))
                continue;
            for (let structureType in Memory.rooms[roomName]["structures"]) {
                hash4[structureType] = hash4[structureType] || {};
                hash4[structureType].length = (hash4[structureType].length || 0) + JSON.stringify(Memory.rooms[roomName]["structures"][structureType]).length;
                let cpu = Game.cpu.getUsed();
                let some = JSON.parse(JSON.stringify(Memory.rooms[roomName]["structures"][structureType]));
                hash4[structureType].cpu = (hash4[structureType].cpu || 0) + (Game.cpu.getUsed() - cpu);
            }
        }

        for (let coll of [hash, hash2, hash4]) {
            let totalLength = 0;
            let totalCpu = 0;
            for (let key in coll) {
                totalLength += coll[key].length;
                totalCpu += coll[key].cpu;
            }
            console.log("Total: length=" + totalLength + ", cpu=" + _.floor(totalCpu, 1));
            for (let key of _.keys(coll).sort((a, b) => coll[b].cpu - coll[a].cpu) )
                console.log(key + ": " + coll[key].length + "\t" + _.floor(coll[key].cpu, 1));
            console.log("\n");
        }
    },

    nukerInfo: function() {
        for (let r of _.filter(Game.rooms, r => r.controller && r.controller.my)) {
            let nuker = r.getNuker();
            if(!nuker)
                continue;
            console.log(r.name + ": energy=" + nuker.energy + "; ghodium=" + nuker.ghodium + ";\t " + nuker.pos.getKey(1) + `  Game.getObjectById("${nuker.id}").launchNuke(new RoomPostion())`);
        }
    },

    needsInfo: function() {
        let print= ""; 
        for (let roomName in Memory.rooms) {
            let nr = Memory.rooms[roomName].needResources; 
            if (!nr)
                continue;
            print += roomName + ": ";
            for(let rt in nr) {
                if (rt.length == 1 && nr[rt] > 1000)
                    print += rt + ":" + nr[rt] + "; ";
            } 
            print += "\n";
        }
        console.log(print)
    },
};

module.exports = utils;
profiler.registerObject(utils, 'utils');