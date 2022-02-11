// Copyright 2021 (c) Andreas Heine
//
//   Licensed under the Apache License, Version 2.0 (the 'License');
//   you may not use this file except in compliance with the License.
//   You may obtain a copy of the License at
//
//       http://www.apache.org/licenses/LICENSE-2.0
//
//   Unless required by applicable law or agreed to in writing, software
//   distributed under the License is distributed on an 'AS IS' BASIS,
//   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//   See the License for the specific language governing permissions and
//   limitations under the License.

import { 
    AddressSpace,
    UAObjectType,
    DataType,
    coerceLocalizedText,
    RaiseEventData,
    Variant,
    StatusCodes,
    ConditionSnapshot,
    NodeId
} from 'node-opcua'

import { ServerRolePermissionGroup } from './../permissiongroups'

export const createOwnServerAddressspaceLogic = async (addressSpace: AddressSpace): Promise<void> => {
    const namespace = addressSpace?.getOwnNamespace()
    const diIdx = addressSpace?.getNamespaceIndex('http://opcfoundation.org/UA/DI/')
    
    const softwareType = addressSpace?.findNode(`ns=${diIdx};i=15106`) as UAObjectType
    const software = softwareType?.instantiate({
        browseName: 'SoftwareType',
        organizedBy: addressSpace.rootFolder.objects,
    })
    const model = software?.getPropertyByName('Model')
    model?.setValueFromSource({
        value: coerceLocalizedText('SampleServer-node-opcua'),
        dataType: DataType.LocalizedText,
    })

    const manufacturer = software?.getPropertyByName('Manufacturer')
    manufacturer?.setValueFromSource({
        value: coerceLocalizedText('Andreas Heine'),
        dataType: DataType.LocalizedText,
    })
    const softwareRevision = software?.getPropertyByName('SoftwareRevision')
    softwareRevision?.setValueFromSource({
        value: 'v1.0.0',
        dataType: DataType.String,
    })

    const dev = namespace.addObject({
        browseName: 'DEV',
        organizedBy: addressSpace.rootFolder.objects,
        eventSourceOf: addressSpace.rootFolder.objects.server,
        rolePermissions: ServerRolePermissionGroup.RESTRICTED,
    })

    const demoEvent = namespace.addEventType({
        browseName: 'DemoEventType',
        subtypeOf:  "BaseEventType",
        isAbstract: false
    })

    const testEvents = namespace.addObject({
        browseName: 'TestEvents',
        organizedBy: dev,
        notifierOf: dev,
    })

    const myEvent = namespace.addObject({
        browseName: 'myEventNotifier',
        componentOf: testEvents,
        eventSourceOf: testEvents,
        eventNotifier: 1, // 0:None, 1:SubscribeToEvents, 2:HistoryRead, 3:HistoryWrite
    })

    let count: number = 100
    setInterval(() => {
        count = count + 50
        if (count > 1000) {
            count = 100
        }
        const eventData: RaiseEventData = {
            message: new Variant({
                value: `Severity at: ${count}`,
                dataType: DataType.String,
            }),
            severity: new Variant({
                value: count,
                dataType: DataType.Int32,
            })
        }
        myEvent.raiseEvent(demoEvent, eventData)
    }, 60000)

    const mySeverity = namespace.addVariable({
        browseName: 'MySeverity',
        componentOf: dev,
        description: coerceLocalizedText('Value must be between 1000 and 100') || undefined,
        dataType: DataType.Double,
        value: {
            get: () => {
                return new Variant({
                    value: count,
                    dataType: DataType.Double
            })},
            set: (variant: Variant) => {
                if (variant.value > 1000 || variant.value < 100) {
                    return StatusCodes.BadOutOfRange
                } else {
                    count = variant.value
                    return StatusCodes.Good
                }
            }
        },
        eventSourceOf: dev,
    })

    addressSpace?.installHistoricalDataNode(mySeverity, {
        maxOnlineValues: 100,
    })

    const mySecretVar = namespace.addVariable({
        browseName: 'MySecretVar',
        componentOf: dev,
        description: coerceLocalizedText('Try change me!') || undefined,
        dataType: DataType.Int32,
        value: {
            value: 0,
            dataType: DataType.Int32
        },
        rolePermissions: ServerRolePermissionGroup.RESTRICTED
    })

    let myValue = 25
    const myVar = namespace.addVariable({
        browseName: 'MyVar',
        componentOf: dev,
        dataType: DataType.Double,
        value: {
            get: function (this) {
                // myValue += 0.25
                return new Variant({
                    value: myValue,
                    dataType: DataType.Double
            })},
        },
        eventSourceOf: dev,
    })

    setInterval(()=>{
        myValue+=1
        if (myValue >= 60) {
            myValue = -25;
        }
    }, 1000)

    const ownConditionEventType = namespace.addEventType({
        browseName: 'ownConditionEventType',
        subtypeOf:  "ConditionType",
        isAbstract: false
    })

    const cond = namespace.instantiateCondition(ownConditionEventType, {
        browseName: 'MyCondition',
        conditionName: 'MyCondition',
        componentOf: dev,
        conditionSource: dev,
        optionals: [
            "ConfirmedState", "Confirm"
        ]
    })

    cond.severity.setValueFromSource({
        value: 150,
        dataType: DataType.UInt16
    })

    cond.message.setValueFromSource({
        value: "MyCondition is Good!",
        dataType: DataType.LocalizedText
    })

    cond.retain.setValueFromSource({
        value: true,
        dataType: DataType.Boolean
    })

    cond.time.setValueFromSource({
        value: new Date(),
        dataType: DataType.DateTime
    })

    setInterval(() => {

        if (cond.message.readValue().value.value.text == "MyCondition is Good!") {
            cond.severity.setValueFromSource({
                value: 800,
                dataType: DataType.UInt16
            })
    
            cond.message.setValueFromSource({
                value: "MyCondition is Bad!",
                dataType: DataType.LocalizedText
            })
    
            cond.time.setValueFromSource({
                value: new Date(),
                dataType: DataType.DateTime
            })
        } else {
            cond.severity.setValueFromSource({
                value: 150,
                dataType: DataType.UInt16
            })
        
            cond.message.setValueFromSource({
                value: "MyCondition is Good!",
                dataType: DataType.LocalizedText
            })
        
            cond.time.setValueFromSource({
                value: new Date(),
                dataType: DataType.DateTime
            })
        }

        let snap: ConditionSnapshot = new ConditionSnapshot(cond, new NodeId())
        cond.raiseConditionEvent(snap, true)

    }, 15000)


    const ownEventType = namespace.addEventType({
        browseName: 'ownLimitAlarmType',
        subtypeOf:  "NonExclusiveLimitAlarmType",
        isAbstract: false
    })

    const alarm = namespace.instantiateNonExclusiveLimitAlarm(ownEventType, {
        browseName: 'MyVarNonExclusiveLimitAlarm',
        conditionName: 'MyVarNonExclusiveLimitAlarm',
        componentOf: dev,
        conditionSource: myVar,
        highHighLimit: 50.0,
        highLimit: 40.0,
        inputNode: myVar,
        lowLimit: 20.0,
        lowLowLimit: -5.0,
    })

    alarm.retain.setValueFromSource({
        value: true,
        dataType: DataType.Boolean
    })
}