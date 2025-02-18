const { contextBridge } = require('electron')
import { dicomParserAPI } from './dicomAPI/dicomParserAPI'

contextBridge.exposeInMainWorld('dicomParserAPI', dicomParserAPI)

