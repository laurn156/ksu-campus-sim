"""Local, single-client Mega serial bridge; communicates with its parent over stdin/stdout."""
import os, select, sys, termios
path='/dev/ttyACM0'
fd=os.open(path, os.O_RDWR|os.O_NOCTTY|os.O_NONBLOCK)
a=termios.tcgetattr(fd)
a[0]=a[1]=a[3]=0
a[2]=(a[2] & ~(termios.PARENB|termios.CSTOPB|termios.CSIZE)) | termios.CS8|termios.CLOCAL|termios.CREAD
a[4]=a[5]=termios.B115200
termios.tcsetattr(fd,termios.TCSANOW,a)
pending=b''
try:
 while True:
  readable,_,_=select.select([fd,sys.stdin.buffer],[],[],1)
  if fd in readable:
   try: data=os.read(fd,4096)
   except BlockingIOError: data=b''
   if data: sys.stdout.buffer.write(data);sys.stdout.buffer.flush()
  if sys.stdin.buffer in readable:
   data=os.read(sys.stdin.fileno(),4096)
   if not data: break
   pending+=data
  if pending:
   try: pending=pending[os.write(fd,pending):]
   except BlockingIOError: pass
finally:
 os.close(fd)
