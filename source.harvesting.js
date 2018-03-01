let roomLayout = require('roomLayout');
let simpleRoom = require('room.simple');
let pathUtils = require('path.utils');

module.exports = {
    "run": basicManager
};
function values(dict){
    return Object.keys(dict).map((k) => dict[k]);
}

function basicManager(){
    takeVisibleInputs();
    removeStale();
    acquireHarvesters();
    harvestSources();
    depositIncome();
}

function removeStale(){
    // TODO transition to second time based way.
    let spawnNames = Object.keys(Game.spawns);
    if (spawnNames.length === 0) { return }
    let firstSpawn = Game.spawns[spawnNames[0]];
    for (let sourceId in Memory.sources) {
        let sourceMemory = Memory.sources[sourceId];
        if (firstSpawn.pos.roomName !== sourceMemory.pos.roomName) {
            delete Memory.sources[sourceId];
        }
    }

    for (let sourceId in Memory["sources"]){
        if (isStale(Memory.sources[sourceId])){
            //console.log(sourceId + " is stale - deleted");
            //delete Memory.sources[sourceId]
        }
    }
}
function isStale(source){
    return false;
    return source.lastUpdatedTime + SECONDS_TO_KEEP_SOURCES < Game.time;
}
function takeVisibleInputs(){

    let spawnNames = Object.keys(Game.spawns);
    if (spawnNames.length === 0) { return }
    let firstSpawn = Game.spawns[spawnNames[0]];

    for (let source of firstSpawn.room.find(FIND_SOURCES)) {
        if (Memory.sources[source.id] === undefined || 1) {
            Memory.sources[source.id] = getSourceDetails(source, firstSpawn);
        }
    }
}
function harvestSources(){
    for (let sourceId in Memory["sources"]){
        let sourceRecord = Memory.sources[sourceId];
        harvestSource(sourceRecord);
    }
}
function harvestSource(sourceRecord){
    let creep = Game.creeps[sourceRecord.primaryWorker];
    if (!creep){
        console.log("couldn't acquire creep to harvest ", sourceRecord.id);
        return;}

    let source = Game.getObjectById(sourceRecord.id);
    if (creep.harvest(source) === ERR_NOT_IN_RANGE){
        if(pathUtils.moveToByPatfinderPath(creep, sourceRecord.pathFromSpawn)){
        //if(creep.moveByPath(sourceRecord.pathFromSpawn) === ERR_NOT_FOUND){
            console.log(creep.name + " moving to beginning of source path");
            creep.moveTo(sourceRecord.pathFromSpawn[0].x, sourceRecord.pathFromSpawn[0].y);
        }
    }
}
function depositIncome() {
    for (let sourceId in Memory["sources"]) {
        let sourceRecord = Memory.sources[sourceId];
        depositIncomeFrom(sourceRecord);
    }
}
function depositIncomeFrom(sourceRecord) {
    function getStorage(sourceRecord) {
        let spawnNames = Object.keys(Game.spawns);
        if (spawnNames.length === 0) {
            return
        }
        return Game.spawns[spawnNames[0]];
    }

    let storage = getStorage(sourceRecord);
    let creep = Game.creeps[sourceRecord.primaryWorker];
    if (!creep || !storage) {
        return;
    }
    creep.transfer(storage, RESOURCE_ENERGY);
}
function acquireHarvesters() {
    for (let sourceId in Memory["sources"]) {
        let sourceRecord = Memory.sources[sourceId];
        acquireHarvestersFor(sourceRecord);
    }
}
function acquireHarvestersFor(sourceRecord){

    // TODO better test that total work assgined meets supply, test for aging harvesters
    if (Game.creeps[sourceRecord.primaryWorker] !== undefined){
        return;
    }
    console.log("Source ",sourceRecord.id," in ", sourceRecord.pos.roomName, " needs more workers");
    sourceRecord.primaryWorker = findAvailableWorker(sourceRecord);
    if (Game.creeps[sourceRecord.primaryWorker] !== undefined){
        console.log("Source ",sourceRecord.id," in ", sourceRecord.pos.roomName, " found an availible worker: ", sourceRecord.primaryWorker);
        return;
    }
    spawnHarvester(sourceRecord);
}
function findAvailableWorker(sourceRecord){
    for (name in Game.creeps){
        if (!Game.creeps[name].memory){console.log(name, " has no memory");continue;}
        if (Game.creeps[name].memory.employer && Game.creeps[name].memory.employer === sourceRecord.id){
            return name;
        }
    }
    return undefined;
}
function spawnHarvester(sourceRecord) {
    let spawnNames = Object.keys(Game.spawns);
    if (spawnNames.length === 0) {
        return
    }
    let firstSpawn = Game.spawns[spawnNames[0]];
    if (Game.creeps[sourceRecord.primaryWorker] === undefined || sourceRecord.primaryWorker < 0) {
        console.log("Source ", sourceRecord.id, " in ", sourceRecord.pos.roomName, " is creating a new worker");
        sourceRecord.primaryWorker = firstSpawn.createCreep([WORK, WORK, MOVE, CARRY], undefined, {"employer":sourceRecord.id});
    }
}

function getSourceDetails(source, spawn){

    let layoutSource = roomLayout.getSourceRecord(source.pos);
    let closestSpawn = spawn;

    let pathFromSpawn = closestSpawn.pos.findPathTo(source);

    let reversePath = pathUtils.reversePath(layoutSource.pathToController);

    let sourceDetail =  {
        'pos': source.pos,
        'id': source.id,
        'energyCapacity': source.energyCapacity,
        'harvestSpot': layoutSource.harvestSpot,
        'energyPickupSpot': layoutSource.energyPickupSpot,
        'energyDropoffSpot': layoutSource.energyDropoffSpot,
        'controllerWorkSpot': layoutSource.upgradeSpot,
        'closestSpawn': closestSpawn.name,
        'pathFromSpawn': layoutSource.pathFromSpawn,
        'pathFromController': reversePath,
        'pathToController': layoutSource.pathToController,
        'distToSpawn': pathFromSpawn.length,
        'primaryWorker': '',
        'workers': []
    };
    return sourceDetail;
}

