import { Iroh, DownloadPolicy, FilterKind, ShareMode, AddrInfoOptions, Query, PublicKey } from '@number0/iroh'
import fs from 'fs'

const logEvents = prefix => (err, arg) => console.log(`${prefix}:`, err || arg)

// create nodes
try {fs.rmSync('./data2', {recursive: true, force: true})} catch (e) {}
const node = await Iroh.persistent('./data', 
  // {blobEvents: logEvents('blob event node1')}
)
const node2 = await Iroh.persistent('./data2', 
  // {blobEvents: logEvents('blob event node2')}
)

// test node.node
// console.log('node.stats()', await node.node.stats()) // metrics are disabled
// console.log('node.status()', await node.node.status())
// console.log('node2.status()', await node2.node.status())
// console.log('node.myRpcAddr()', await node.node.myRpcAddr())

// test net
// console.log('net', node.net)
console.log('net.nodeId()', await node.net.nodeId())
console.log('net.nodeAddr()', await node.net.nodeAddr())
console.log('node2 net.nodeAddr()', await node2.net.nodeAddr())
console.log('net.homeRelay()', await node.net.homeRelay())
console.log('net.remoteInfoList()', await node.net.remoteInfoList())
console.log('net.remoteInfo()', await node.net.remoteInfo(PublicKey.fromString(await node2.net.nodeId())))

// test authors
// console.log('authors.create()', (await node.authors.create()).toString())
console.log('authors.list()', (await node.authors.list()).map(a => a.toString()))
console.log('authors.default()', (await node.authors.default()).toString())
const defaultAuthorId = await node.authors.default()
console.log('authors.export()', (await node.authors.export(defaultAuthorId)).toString())

// test docs
// console.log('docs.create()', (await node.docs.create()).id())
console.log('docs.list()', await node.docs.list())
const doc1Id = (await node.docs.list())[0].namespace
const doc1 = await node.docs.open(doc1Id)
// doc1.subscribe(logEvents('doc1 event node1'))
console.log('docs.open()', doc1.id())

// test doc
const key = Array.from(Buffer.from('my key'))
const value = Array.from(Buffer.from('my value'))
console.log('doc.setBytes()', (await doc1.setBytes(defaultAuthorId, key, value)).toString())
const doc1Ticket = await doc1.share(ShareMode.Read, AddrInfoOptions.RelayAndAddresses)
console.log('doc.share()', doc1Ticket.capability, doc1Ticket.capabilityKind, doc1Ticket.nodes, doc1Ticket.toString())

// test download doc from other node
const doc1Node2 = await node2.docs.join(doc1Ticket)
// doc1Node2.subscribe(logEvents('doc1 event node2'))
const node2PendingContentReady = new Promise(resolve => doc1Node2.subscribe((err, event) => event?.pendingContentReady && resolve()))

// don't download all keys
const otherKey = Array.from(Buffer.from('other key'))
const downloadPolicy = DownloadPolicy.nothingExcept([FilterKind.exact(otherKey)])
// await doc1Node2.setDownloadPolicy(downloadPolicy)

// wait for sync to finish
await node2PendingContentReady
console.log('node2 doc.status()', await doc1Node2.status())
const entry = await doc1Node2.getExact(defaultAuthorId, key, false)
console.log('node2 doc.getOne()', entry)
const node2Value = Buffer.from(await node.blobs.readToBytes(entry.hash)).toString()
console.log('node 2 value', node2Value)

// test gossip
const topic = [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
const gossipMessageSender = await node.gossip.subscribe(topic, [], (err, message) => {
  console.log('gossip message', err || message)
})
setInterval(() => {
  const message = Array.from(Buffer.from(`node1: my new message ${Date.now()}`))
  gossipMessageSender.broadcast(message).catch(console.log)
}, 3000)

const node2GossipMessageSender = await node2.gossip.subscribe(topic, [], (err, message) => {
  console.log('gossip message', err || message)
})
setInterval(() => {
  const message = Array.from(Buffer.from(`node2: my new message ${Date.now()}`))
  node2GossipMessageSender.broadcast(message).catch(console.log)
}, 4000)
