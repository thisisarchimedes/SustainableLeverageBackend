import cron from 'node-cron';
import CurvePoolMonitor from '../lib/CurvePoolMonitor';
import {Logger} from "@thisisarchimedes/backend-sdk"

export class PositionExpirator{

    private readonly logger:Logger;
    private readonly rpcURL :string;
    private readonly lvWBTCPoolAddress :string;

    constructor(logger:Logger, rpcURL :string, lvWBTCPoolAddress:string){
        this.logger = logger;
        this.rpcURL = rpcURL;
        this.lvWBTCPoolAddress = lvWBTCPoolAddress;
    }

    public async getLVBTCPoolState() :Promise<void>{
        curveMonitor:CurvePoolMonitor = new CurvePoolMonitor();



    }

}



// cron.schedule('')