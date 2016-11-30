// @flow

class Deferred {
    promise: Promise<any>
    resolve: (data: any) => void
    reject: (reason: any) => void
    constructor() {
        this.promise = new Promise((resolve, reject) => {
            this.resolve = resolve
            this.reject = reject
        })
    }
}

interface PayloadStatic<T> {
    id: number,
    command: string,
    data: T,
    reply: boolean
}

let count = 0

function getUID() {
    return count++
}

type callbackStatic = (...data: any) => any

const getTransactionKey = (data: PayloadStatic<any>) => `${data.command}(${data.id})`

export function createMessager(sendHandler: (data: any) => void) {

    const transactions: { [key: string]: Deferred } = {}
    const callbacks: { [key: string]: callbackStatic } = {}

    function bind<TArgs, TReturn>(name: string) {
        return (...args: any): Promise<TReturn> => send(name, args)
    }

    function define(name: string, fn: callbackStatic) {
        callbacks[name] = (args: any) => fn(...args)
        return { define, bind }
    }

    /** sender parts */
    function sender(data: PayloadStatic<any>) {
        sendHandler(data)
    }

    function send(command: string, data: any) {
        const payload: PayloadStatic<any> = {
            command, data, id: getUID(), reply: false
        }
        const defer = new Deferred()
        transactions[getTransactionKey(payload)] = defer
        sender(payload)
        return defer.promise
    }

    function reply(data: PayloadStatic<any>, result: any) {
        data.reply = true
        data.data = result
        sender(data)
    }
    /** listener parts */
    function listener(data: PayloadStatic<any>) {
        if (data.reply) {
            const key = getTransactionKey(data)
            transactions[key] && transactions[key].resolve(data.data)
        } else {
            if (callbacks[data.command]) {
                const result = callbacks[data.command](data.data)
                if (result && result.then) {
                    result.then(d => reply(data, d))
                } else {
                    reply(data, result)
                }
            } else {
                reply(data, null)
            }
        }
    }
    return { bind, define, listener }
}